// 스타크래프트 스타일 게임 사운드 (Web Audio API + 에셋 파일 지원)
var audioCtx = null;
var soundFiles = {};

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// 에셋 폴더에서 사운드 파일 로드 (assets/sounds/ 폴더 사용)
var SOUND_KEYS = ['select', 'move', 'attack', 'build', 'unitReady', 'error', 'click', 'minimapMove'];
(function loadSoundAssets() {
    var exts = ['mp3', 'ogg'];
    SOUND_KEYS.forEach(function(key) {
        (function tryNext(extIdx) {
            if (extIdx >= exts.length) return;
            var a = new Audio();
            var path = 'assets/sounds/' + key + '.' + exts[extIdx];
            a.addEventListener('canplaythrough', function() { soundFiles[key] = a; }, { once: true });
            a.addEventListener('error', function() { tryNext(extIdx + 1); }, { once: true });
            a.src = path;
            a.load();
        })(0);
    });
})();

function playAsset(key) {
    if (soundFiles[key]) {
        try {
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            var c = soundFiles[key].cloneNode();
            c.volume = 0.6;
            c.play().catch(function() {});
        } catch (e) {}
        return true;
    }
    return false;
}

// 스타크래프트 스타일 합성음 (에셋 없을 때 폴백)
function playTone(freq, duration, type, volume, startTime) {
    try {
        var ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        startTime = startTime || ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type || 'square';
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
    } catch (e) {}
}

function playNoise(duration, volume, startTime) {
    try {
        var ctx = getAudioContext();
        startTime = startTime || ctx.currentTime;
        var bufferSize = ctx.sampleRate * duration;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * volume;
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(startTime);
        src.stop(startTime + duration);
    } catch (e) {}
}

var Sound = {
    // 유닛/건물 선택 — "Acknowledged" 스타일
    select: function() {
        if (playAsset('select')) return;
        var t = getAudioContext().currentTime;
        playTone(520, 0.06, 'square', 0.14, t);
        playTone(780, 0.05, 'square', 0.1, t + 0.07);
        playTone(1040, 0.04, 'square', 0.08, t + 0.14);
    },
    // 이동 명령
    move: function() {
        if (playAsset('move')) return;
        var t = getAudioContext().currentTime;
        playTone(640, 0.06, 'square', 0.12, t);
        playTone(800, 0.04, 'square', 0.08, t + 0.06);
    },
    // 공격 명령
    attack: function() {
        if (playAsset('attack')) return;
        var t = getAudioContext().currentTime;
        playTone(320, 0.08, 'sawtooth', 0.14, t);
        playTone(240, 0.1, 'sawtooth', 0.12, t + 0.06);
        playTone(180, 0.06, 'square', 0.08, t + 0.14);
    },
    // 건물 건설
    build: function() {
        if (playAsset('build')) return;
        var t = getAudioContext().currentTime;
        playNoise(0.04, 0.12, t);
        playTone(280, 0.08, 'square', 0.1, t + 0.02);
        playTone(360, 0.1, 'square', 0.1, t + 0.1);
        playTone(440, 0.06, 'square', 0.08, t + 0.2);
    },
    // 유닛 생성 완료
    unitReady: function() {
        if (playAsset('unitReady')) return;
        var t = getAudioContext().currentTime;
        playTone(880, 0.05, 'square', 0.1, t);
        playTone(1320, 0.06, 'square', 0.1, t + 0.06);
        playTone(1760, 0.08, 'sine', 0.06, t + 0.12);
    },
    // 버튼 클릭
    click: function() {
        if (playAsset('click')) return;
        playTone(900, 0.03, 'square', 0.08);
    },
    // 미니맵 이동
    minimapMove: function() {
        if (playAsset('minimapMove')) return;
        playTone(400, 0.04, 'sine', 0.06);
    },
    // 에러 (자원 부족 등) — "Not enough minerals" 스타일
    error: function() {
        if (playAsset('error')) return;
        var t = getAudioContext().currentTime;
        playTone(220, 0.12, 'sawtooth', 0.12, t);
        playTone(180, 0.1, 'sawtooth', 0.1, t + 0.08);
        playTone(140, 0.14, 'square', 0.1, t + 0.16);
    }
};

window.Sound = Sound;
