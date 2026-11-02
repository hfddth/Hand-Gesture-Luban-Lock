// Camera transport only; the archive's controllers and pose mapping stay intact.
const BASE = new URL('../../vendor/mediapipe/hands/', import.meta.url).href;
let runtimePromise;
const error = (name, message) => Object.assign(new Error(message), {name});

function deadline(promise, ms, name, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(error(name, message)), ms);
  })]).finally(() => clearTimeout(timer));
}

export function cameraErrorMessage(e) {
  return ({
    NotAllowedError: '摄像头访问被拒绝，请在浏览器的网站权限中允许摄像头后重试',
    PermissionDeniedError: '请在浏览器的网站权限中允许摄像头后重试',
    CameraPolicyError: '当前内嵌窗口未开放摄像头，请在浏览器中直接打开游戏网址',
    CameraContextError: '请通过 HTTPS 网页或本机 localhost 打开游戏后使用摄像头',
    NotFoundError: '未找到摄像头，请连接设备后重试',
    NotReadableError: '摄像头无法读取，请关闭其他占用摄像头的应用，并检查系统相机权限',
    OverconstrainedError: '摄像头不支持当前设置，请更换摄像头后重试',
    CameraPermissionTimeout: '尚未收到授权，请在浏览器弹窗中允许摄像头，再点击重试',
    CameraPlaybackError: '摄像头画面未能播放，请重新开启摄像头',
    CameraRuntimeError: '手势识别资源未能加载，请检查网络后重试',
    CameraEndedError: '摄像头连接已断开，请检查设备或权限后重新开启',
    AbortError: '摄像头启动已取消，可重新开启',
  })[e?.name] || '摄像头暂不可用，请检查设备后重试';
}

function loadRuntime() {
  if (globalThis.Hands) return Promise.resolve();
  runtimePromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(error('CameraRuntimeError', '识别脚本加载超时')), 15000);
    const finish = e => {
      clearTimeout(timer); script.onload = script.onerror = null;
      if (e) { script.remove(); reject(e); } else resolve();
    };
    script.src = BASE + 'hands.js';
    script.onload = () => finish(globalThis.Hands ? null : error('CameraRuntimeError', '识别脚本不可用'));
    script.onerror = () => finish(error('CameraRuntimeError', '识别脚本加载失败'));
    document.head.append(script);
  }).catch(e => { runtimePromise = null; throw e; });
  return runtimePromise;
}

export async function startRecognitionCamera(video, onResults, {onProgress = () => {}, onError = () => {}} = {}) {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    throw error('CameraContextError', '需要安全网页');
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (policy?.allowsFeature && !policy.allowsFeature('camera'))
    throw error('CameraPolicyError', '嵌入页面禁止摄像头');
  let stopped = false, stream, hands, raf, active = false;
  const stopTracks = value => value?.getTracks().forEach(track => track.stop());
  const closeHands = () => { try { Promise.resolve(hands?.close()).catch(() => {}); } catch {} };
  const stop = () => {
    if (stopped) return;
    stopped = true; active = false; cancelAnimationFrame(raf);
    removeEventListener('pagehide', stop);
    stopTracks(stream);
    if (video.srcObject === stream) { video.pause(); video.srcObject = null; }
    closeHands();
  };
  const check = () => { if (stopped) throw error('AbortError', '启动已取消'); };
  const fail = e => { if (stopped) return; stop(); onError(e); };
  addEventListener('pagehide', stop, {once: true});
  try {
    onProgress('permission');
    // Request permission in the click handler before waiting on any model/network.
    const pendingStream = navigator.mediaDevices.getUserMedia({audio: false, video: {
      facingMode: {ideal: 'user'}, width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 30, max: 30},
    }});
    pendingStream.then(value => { if (stopped) stopTracks(value); }, () => {});
    stream = await deadline(pendingStream, 20000, 'CameraPermissionTimeout', '等待摄像头授权超时');
    check(); video.muted = true; video.autoplay = true; video.playsInline = true;
    video.setAttribute('playsinline', ''); video.srcObject = stream;
    await deadline(video.play(), 10000, 'CameraPlaybackError', '摄像头画面未就绪');
    check(); onProgress('loading');
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => fail(error('CameraEndedError', '摄像头断开')), {once: true});
    await loadRuntime(); check();
    hands = new globalThis.Hands({locateFile: file => BASE + file});
    hands.setOptions({maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .62, minTrackingConfidence: .68});
    hands.onResults(results => { if (!stopped) onResults(results); });
    const initialized = hands.initialize();
    Promise.resolve(initialized).then(() => { if (stopped) closeHands(); }, () => {});
    await deadline(initialized, 30000, 'CameraRuntimeError', '识别模型初始化超时');
    check();
    const send = () => deadline(hands.send({image: video}), 15000, 'CameraRuntimeError', '识别响应超时');
    await send(); check(); active = true; onProgress('ready');
    let lastTime = video.currentTime;
    const frame = async () => {
      if (!active || stopped) return;
      try {
        if (!video.paused && video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime; await send();
        }
        if (!stopped) raf = requestAnimationFrame(frame);
      } catch (e) { fail(e); }
    };
    raf = requestAnimationFrame(frame);
    return {hands, stop};
  } catch (e) { stop(); throw e; }
}
