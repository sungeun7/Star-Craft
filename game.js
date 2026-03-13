// 게임 캔버스 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const gameAreaEl = document.querySelector('.game-area');

// 캔버스 크기 설정
function resizeCanvas() {
    // 실제 표시 영역(.game-area) 크기에 맞춰 캔버스 픽셀 크기 설정
    const rect = gameAreaEl ? gameAreaEl.getBoundingClientRect() : null;
    const w = Math.max(1, Math.floor(rect && rect.width ? rect.width : window.innerWidth));
    const h = Math.max(1, Math.floor(rect && rect.height ? rect.height : (window.innerHeight - 200)));
    canvas.width = w;
    canvas.height = h;
    minimapCanvas.width = 160;
    minimapCanvas.height = 160;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', function() { resizeCanvas(); });

// 맵 크기 및 양끝 기지 위치
const MAP_W = 3000;
const MAP_H = 3000;
const PLAYER_BASE_X = 220;
const PLAYER_BASE_Y = 220;
const ENEMY_BASE_X = MAP_W - 220;
const ENEMY_BASE_Y = MAP_H - 220;

// 게임 상태
const gameState = {
    minerals: 100,
    gas: 100,
    supply: { current: 5, max: 8 },
    selectedUnits: [],
    buildings: [],
    units: [],
    enemyUnits: [],
    enemyBuildings: [],
    enemyMinerals: 200,
    enemyGas: 50,
    enemySupply: { current: 5, max: 8 },
    enemyAITimer: 0,
    totalFrames: 0,
    enemyAttackUnlockFrame: 600,
    resources: [],
    camera: { x: 0, y: 0 },
    buildMode: null,
    buildCost: null,
    mapSize: { width: MAP_W, height: MAP_H },
    playerRace: 'terran',
    upgrades: {}, // 완료된 업그레이드 상태(키: upgradeId, 값: 레벨/true)
    gameOver: false,
    victory: false
};

function clampCamera() {
    const maxX = Math.max(0, gameState.mapSize.width - canvas.width);
    const maxY = Math.max(0, gameState.mapSize.height - canvas.height);
    gameState.camera.x = Math.max(0, Math.min(gameState.camera.x, maxX));
    gameState.camera.y = Math.max(0, Math.min(gameState.camera.y, maxY));
}

// 유닛 타입 정의 (테란 / 저그 / 프로토스 - 스타크래프트 동일)
const unitTypes = {
    // ===== 테란 =====
    scv: { name: 'SCV', cost: { minerals: 50, gas: 0 }, supply: 1, hp: 45, maxHp: 45, speed: 1.5, size: 12, color: '#ffd700', canBuild: true, canMine: true },
    marine: { name: '마린', cost: { minerals: 50, gas: 0 }, supply: 1, hp: 40, maxHp: 40, speed: 2, size: 10, color: '#3498db', attack: 6, range: 5, canAttack: true, canGarrison: true },
    firebat: { name: '파이어뱃', cost: { minerals: 50, gas: 25 }, supply: 1, hp: 50, maxHp: 50, speed: 1.8, size: 10, color: '#c0392b', attack: 8, range: 2, canAttack: true, canGarrison: true },
    ghost: { name: '고스트', cost: { minerals: 25, gas: 75 }, supply: 1, hp: 45, maxHp: 45, speed: 2, size: 10, color: '#8e44ad', attack: 10, range: 6, canAttack: true, canGarrison: true },
    medic: { name: '메딕', cost: { minerals: 50, gas: 25 }, supply: 1, hp: 60, maxHp: 60, speed: 2, size: 10, color: '#ffffff' },
    vulture: { name: '벌처', cost: { minerals: 75, gas: 0 }, supply: 2, hp: 80, maxHp: 80, speed: 3, size: 12, color: '#95a5a6', attack: 10, range: 6, canAttack: true },
    tank: { name: '시즈 탱크', cost: { minerals: 150, gas: 100 }, supply: 2, hp: 150, maxHp: 150, speed: 1, size: 16, color: '#7f8c8d', attack: 30, range: 12, canAttack: true },
    goliath: { name: '골리앗', cost: { minerals: 100, gas: 50 }, supply: 2, hp: 125, maxHp: 125, speed: 1.5, size: 14, color: '#5d6d7e', attack: 12, range: 8, canAttack: true },
    wraith: { name: '레이스', cost: { minerals: 150, gas: 100 }, supply: 2, hp: 120, maxHp: 120, speed: 2.5, size: 12, color: '#9fb3c8', attack: 16, range: 6, canAttack: true },
    dropship: { name: '드랍십', cost: { minerals: 100, gas: 100 }, supply: 2, hp: 150, maxHp: 150, speed: 2.4, size: 14, color: '#c0c0c0' },
    valkyrie: { name: '발키리', cost: { minerals: 250, gas: 125 }, supply: 3, hp: 200, maxHp: 200, speed: 2.5, size: 14, color: '#c9d6ff', attack: 20, range: 6, canAttack: true },
    sciencevessel: { name: '사이언스 베슬', cost: { minerals: 100, gas: 225 }, supply: 2, hp: 200, maxHp: 200, speed: 2, size: 14, color: '#c0ffef' },
    battlecruiser: { name: '배틀크루저', cost: { minerals: 400, gas: 300 }, supply: 6, hp: 500, maxHp: 500, speed: 1.5, size: 20, color: '#c2b59b', attack: 40, range: 8, canAttack: true },
    // ===== 저그 =====
    drone: { name: '드론', cost: { minerals: 50, gas: 0 }, supply: 1, hp: 40, maxHp: 40, speed: 1.6, size: 11, color: '#9966aa', canBuild: true, canMine: true },
    zergling: { name: '저글링', cost: { minerals: 25, gas: 0 }, supply: 1, hp: 35, maxHp: 35, speed: 3.5, size: 8, color: '#cc4466', attack: 5, range: 2, canAttack: true },
    hydralisk: { name: '히드라리스크', cost: { minerals: 75, gas: 25 }, supply: 1, hp: 80, maxHp: 80, speed: 2, size: 12, color: '#66aa44', attack: 10, range: 5, canAttack: true },
    lurker: { name: '러커', cost: { minerals: 125, gas: 125 }, supply: 2, hp: 125, maxHp: 125, speed: 1.5, size: 14, color: '#887744', attack: 20, range: 7, canAttack: true },
    ultralisk: { name: '울트라리스크', cost: { minerals: 200, gas: 200 }, supply: 6, hp: 400, maxHp: 400, speed: 2, size: 22, color: '#885522', attack: 20, range: 2, canAttack: true },
    defiler: { name: '디파일러', cost: { minerals: 50, gas: 150 }, supply: 2, hp: 80, maxHp: 80, speed: 2, size: 12, color: '#553355' },
    queen: { name: '퀸', cost: { minerals: 100, gas: 100 }, supply: 2, hp: 120, maxHp: 120, speed: 2.5, size: 12, color: '#aa66aa' },
    mutalisk: { name: '뮤탈리스크', cost: { minerals: 100, gas: 100 }, supply: 2, hp: 120, maxHp: 120, speed: 3, size: 12, color: '#44aacc', attack: 9, range: 3, canAttack: true },
    scourge: { name: '스커지', cost: { minerals: 25, gas: 75 }, supply: 1, hp: 25, maxHp: 25, speed: 3.5, size: 8, color: '#aa8844', attack: 110, range: 1, canAttack: true },
    guardian: { name: '가디언', cost: { minerals: 50, gas: 100 }, supply: 2, hp: 150, maxHp: 150, speed: 1.5, size: 16, color: '#446688', attack: 20, range: 8, canAttack: true },
    devourer: { name: '디바우러', cost: { minerals: 150, gas: 50 }, supply: 4, hp: 250, maxHp: 250, speed: 1.8, size: 18, color: '#335577', attack: 25, range: 6, canAttack: true },
    overlord: { name: '오버로드', cost: { minerals: 100, gas: 0 }, supply: 0, supplyProvided: 8, hp: 200, maxHp: 200, speed: 1.5, size: 18, color: '#774466', canAttack: false },
    // ===== 프로토스 =====
    probe: { name: '프로브', cost: { minerals: 50, gas: 0 }, supply: 1, hp: 20, maxHp: 20, speed: 1.8, size: 11, color: '#ccaa44', canBuild: true, canMine: true },
    zealot: { name: '질럿', cost: { minerals: 100, gas: 0 }, supply: 2, hp: 100, maxHp: 100, speed: 2.2, size: 12, color: '#4488cc', attack: 16, range: 2, canAttack: true },
    dragoon: { name: '드라군', cost: { minerals: 125, gas: 50 }, supply: 2, hp: 100, maxHp: 100, speed: 1.5, size: 14, color: '#8866cc', attack: 20, range: 6, canAttack: true },
    hightemplar: { name: '고위 기사', cost: { minerals: 50, gas: 150 }, supply: 2, hp: 40, maxHp: 40, speed: 1.5, size: 10, color: '#66aacc', attack: 0, range: 0, canAttack: false },
    darktemplar: { name: '암흑 기사', cost: { minerals: 125, gas: 125 }, supply: 2, hp: 80, maxHp: 80, speed: 2.5, size: 10, color: '#334466', attack: 40, range: 2, canAttack: true },
    archon: { name: '아콘', cost: { minerals: 0, gas: 0 }, supply: 4, hp: 350, maxHp: 350, speed: 2.2, size: 16, color: '#66c0ff', attack: 30, range: 3, canAttack: true },
    darkarchon: { name: '다크 아콘', cost: { minerals: 0, gas: 0 }, supply: 4, hp: 300, maxHp: 300, speed: 2.2, size: 16, color: '#883366' },
    reaver: { name: '리버', cost: { minerals: 200, gas: 100 }, supply: 4, hp: 100, maxHp: 100, speed: 1, size: 18, color: '#778899', attack: 100, range: 8, canAttack: true },
    observer: { name: '옵저버', cost: { minerals: 25, gas: 75 }, supply: 1, hp: 60, maxHp: 60, speed: 2, size: 10, color: '#aaaaaa' },
    shuttle: { name: '셔틀', cost: { minerals: 200, gas: 0 }, supply: 2, hp: 150, maxHp: 150, speed: 2.2, size: 14, color: '#ddddaa' },
    corsair: { name: '커세어', cost: { minerals: 150, gas: 100 }, supply: 2, hp: 100, maxHp: 100, speed: 3, size: 12, color: '#66aadd', attack: 16, range: 6, canAttack: true },
    carrier: { name: '캐리어', cost: { minerals: 350, gas: 250 }, supply: 6, hp: 300, maxHp: 300, speed: 1.5, size: 20, color: '#ccbb77', attack: 40, range: 8, canAttack: true },
    arbiter: { name: '아비터', cost: { minerals: 100, gas: 350 }, supply: 4, hp: 200, maxHp: 200, speed: 1.8, size: 18, color: '#99ccff', attack: 20, range: 6, canAttack: true }
};

// 건물 타입 정의 (테란 / 저그 / 프로토스)
const buildingTypes = {
    // ===== 테란 =====
    'command-center': { name: '사령부', cost: { minerals: 400, gas: 0 }, size: 70, hp: 1500, maxHp: 1500, color: '#8b4513', canTrain: ['scv'] },
    'supply-depot': { name: '보급고', cost: { minerals: 100, gas: 0 }, size: 42, hp: 500, maxHp: 500, color: '#6b5344', canTrain: [], supplyProvided: 8 },
    'refinery': { name: '정제소', cost: { minerals: 100, gas: 0 }, size: 46, hp: 750, maxHp: 750, color: '#7b6544', canTrain: [] },
    'barracks': { name: '병영', cost: { minerals: 150, gas: 0 }, size: 60, hp: 1000, maxHp: 1000, color: '#654321', canTrain: ['marine', 'firebat', 'medic', 'ghost'] },
    'academy': { name: '아카데미', cost: { minerals: 150, gas: 0 }, size: 48, hp: 750, maxHp: 750, color: '#705438', canTrain: [] },
    'factory': { name: '공장', cost: { minerals: 200, gas: 100 }, size: 55, hp: 1250, maxHp: 1250, color: '#5d4e37', canTrain: ['vulture', 'tank', 'goliath'] },
    'starport': { name: '우주공항', cost: { minerals: 150, gas: 100 }, size: 52, hp: 900, maxHp: 900, color: '#4a5568', canTrain: ['wraith', 'dropship', 'valkyrie', 'battlecruiser'] },
    'science-facility': { name: '과학시설', cost: { minerals: 100, gas: 150 }, size: 50, hp: 850, maxHp: 850, color: '#3d4a5c', canTrain: ['sciencevessel'] },
    'engineering-bay': { name: '공병부', cost: { minerals: 125, gas: 0 }, size: 48, hp: 800, maxHp: 800, color: '#5a4a3a', canTrain: [] },
    'armory': { name: '무기고', cost: { minerals: 100, gas: 50 }, size: 48, hp: 750, maxHp: 750, color: '#554433', canTrain: [] },
    'missile-turret': { name: '미사일 포탑', cost: { minerals: 100, gas: 0 }, size: 32, hp: 200, maxHp: 200, color: '#4d5d6d', canTrain: [] },
    'bunker': { name: '벙커', cost: { minerals: 100, gas: 0 }, size: 40, hp: 400, maxHp: 400, color: '#5d4e37', canTrain: [] },
    // ===== 저그 =====
    'hatchery': { name: '부화장', cost: { minerals: 300, gas: 0 }, size: 58, hp: 1250, maxHp: 1250, color: '#553366', canTrain: ['drone', 'zergling', 'hydralisk', 'mutalisk', 'overlord'] },
    'lair': { name: '레어', cost: { minerals: 150, gas: 100 }, size: 58, hp: 1500, maxHp: 1500, color: '#654477', canTrain: ['drone', 'zergling', 'hydralisk', 'mutalisk', 'overlord'] },
    'hive': { name: '하이브', cost: { minerals: 200, gas: 150 }, size: 62, hp: 2000, maxHp: 2000, color: '#764488', canTrain: ['drone', 'zergling', 'hydralisk', 'mutalisk', 'ultralisk', 'overlord', 'defiler'] },
    'spawning-pool': { name: '번식지', cost: { minerals: 200, gas: 0 }, size: 48, hp: 750, maxHp: 750, color: '#442244', canTrain: ['zergling'] },
    'evolution-chamber': { name: '진화실', cost: { minerals: 75, gas: 0 }, size: 45, hp: 750, maxHp: 750, color: '#552244', canTrain: [] },
    'hydralisk-den': { name: '히드라리스크 굴', cost: { minerals: 100, gas: 100 }, size: 50, hp: 850, maxHp: 850, color: '#663355', canTrain: ['hydralisk', 'lurker'] },
    'spire': { name: '둥지탑', cost: { minerals: 200, gas: 200 }, size: 52, hp: 600, maxHp: 600, color: '#442244', canTrain: ['mutalisk', 'scourge'] },
    'greater-spire': { name: '그레이터 스파이어', cost: { minerals: 100, gas: 150 }, size: 52, hp: 750, maxHp: 750, color: '#553355', canTrain: ['guardian', 'devourer'] },
    'ultralisk-cavern': { name: '울트라리스크 동굴', cost: { minerals: 150, gas: 200 }, size: 54, hp: 900, maxHp: 900, color: '#663322', canTrain: ['ultralisk'] },
    'defiler-mound': { name: '디파일러 마운드', cost: { minerals: 100, gas: 100 }, size: 50, hp: 600, maxHp: 600, color: '#553344', canTrain: ['defiler'] },
    'queen-nest': { name: '여왕 둥지', cost: { minerals: 150, gas: 100 }, size: 48, hp: 700, maxHp: 700, color: '#552233', canTrain: [] },
    'nydus-canal': { name: '나이더스 관문', cost: { minerals: 150, gas: 0 }, size: 44, hp: 500, maxHp: 500, color: '#441122', canTrain: [] },
    'creep-colony': { name: '크립 콜로니', cost: { minerals: 75, gas: 0 }, size: 34, hp: 400, maxHp: 400, color: '#443322', canTrain: [] },
    'sunken-colony': { name: '선큰 콜로니', cost: { minerals: 50, gas: 0 }, size: 36, hp: 300, maxHp: 300, color: '#553322', canTrain: [] },
    'spore-colony': { name: '스포어 콜로니', cost: { minerals: 50, gas: 0 }, size: 36, hp: 300, maxHp: 300, color: '#335544', canTrain: [] },
    // ===== 프로토스 =====
    'nexus': { name: '넥서스', cost: { minerals: 400, gas: 0 }, size: 62, hp: 1500, maxHp: 1500, color: '#334466', canTrain: ['probe'] },
    'pylon': { name: '수정탑', cost: { minerals: 100, gas: 0 }, size: 32, hp: 300, maxHp: 300, color: '#556688', canTrain: [], supplyProvided: 8 },
    'gateway': { name: '게이트웨이', cost: { minerals: 150, gas: 0 }, size: 48, hp: 1000, maxHp: 1000, color: '#445577', canTrain: ['zealot', 'dragoon', 'hightemplar', 'darktemplar'] },
    'forge': { name: '포지', cost: { minerals: 150, gas: 0 }, size: 44, hp: 550, maxHp: 550, color: '#445577', canTrain: [] },
    'assimilator': { name: '어시밀레이터', cost: { minerals: 100, gas: 0 }, size: 40, hp: 450, maxHp: 450, color: '#4a5a6a', canTrain: [] },
    'cybernetics-core': { name: '사이버네틱스 코어', cost: { minerals: 200, gas: 0 }, size: 44, hp: 600, maxHp: 600, color: '#446688', canTrain: [] },
    'shield-battery': { name: '실드 배터리', cost: { minerals: 100, gas: 0 }, size: 32, hp: 200, maxHp: 200, color: '#447799', canTrain: [] },
    'photon-cannon': { name: '광자포', cost: { minerals: 150, gas: 0 }, size: 36, hp: 150, maxHp: 150, color: '#6688aa', canTrain: [] },
    'robotics-facility': { name: '로봇 공장', cost: { minerals: 200, gas: 200 }, size: 52, hp: 1000, maxHp: 1000, color: '#556688', canTrain: ['reaver', 'observer', 'shuttle'] },
    'robotics-support-bay': { name: '로봇 공학 지원소', cost: { minerals: 150, gas: 100 }, size: 42, hp: 450, maxHp: 450, color: '#556688', canTrain: [] },
    'stargate': { name: '스타게이트', cost: { minerals: 150, gas: 150 }, size: 50, hp: 800, maxHp: 800, color: '#446699', canTrain: ['corsair', 'carrier', 'arbiter'] },
    'fleet-beacon': { name: '함대 신호소', cost: { minerals: 300, gas: 200 }, size: 44, hp: 600, maxHp: 600, color: '#556699', canTrain: [] },
    'citadel-of-adun': { name: '아둔의 성소', cost: { minerals: 150, gas: 0 }, size: 46, hp: 600, maxHp: 600, color: '#335577', canTrain: [] },
    'templar-archives': { name: '기사단 기록관', cost: { minerals: 100, gas: 200 }, size: 46, hp: 500, maxHp: 500, color: '#446699', canTrain: [] },
    'observatory': { name: '관측소', cost: { minerals: 50, gas: 100 }, size: 40, hp: 400, maxHp: 400, color: '#557799', canTrain: [] },
    'arbiter-tribunal': { name: '아비터 법정', cost: { minerals: 200, gas: 150 }, size: 44, hp: 500, maxHp: 500, color: '#445577', canTrain: [] }
};

// 주요 업그레이드 정의 (간단 버전)
// 실제 스타1처럼 세부 단계는 아니고, 한 번 클릭 시 전역 스탯을 증가시키는 형태
const buildingUpgrades = {
    // 테란
    'engineering-bay': [
        {
            id: 'terranInfantryWeapons',
            label: '보병 공격 업그레이드 (+2)',
            minerals: 100,
            gas: 100,
            apply: function () {
                unitTypes.marine.attack += 2;
                unitTypes.firebat.attack += 2;
                unitTypes.ghost.attack += 2;
            }
        }
    ],
    'armory': [
        {
            id: 'terranVehicleShipWeapons',
            label: '기계/공중 공격 업그레이드 (+4)',
            minerals: 150,
            gas: 150,
            apply: function () {
                unitTypes.vulture.attack += 4;
                unitTypes.tank.attack += 4;
                unitTypes.goliath.attack += 4;
                unitTypes.wraith.attack += 4;
                unitTypes.valkyrie.attack += 4;
                unitTypes.battlecruiser.attack += 4;
            }
        }
    ],
    // 저그
    'evolution-chamber': [
        {
            id: 'zergGroundWeapons',
            label: '지상 공격 업그레이드 (+2)',
            minerals: 100,
            gas: 100,
            apply: function () {
                unitTypes.zergling.attack += 2;
                unitTypes.hydralisk.attack += 2;
                unitTypes.lurker.attack += 2;
                unitTypes.ultralisk.attack += 2;
            }
        }
    ],
    // 프로토스
    'forge': [
        {
            id: 'protossGroundWeapons',
            label: '지상 공격 업그레이드 (+2)',
            minerals: 100,
            gas: 100,
            apply: function () {
                unitTypes.zealot.attack += 2;
                unitTypes.dragoon.attack += 2;
                unitTypes.darktemplar.attack += 2;
                unitTypes.archon.attack += 2;
                unitTypes.reaver.attack += 2;
            }
        }
    ]
};

// 종족별 표시 (이름, 색상) - 스타크래프트 동일
var RACE_THEMES = {
    terran: {
        units: { scv: { name: 'SCV', color: '#ffd700' }, marine: { name: '마린', color: '#3498db' }, firebat: { name: '파이어뱃', color: '#c0392b' }, ghost: { name: '고스트', color: '#8e44ad' }, vulture: { name: '벌처', color: '#95a5a6' }, tank: { name: '시즈 탱크', color: '#7f8c8d' }, goliath: { name: '골리앗', color: '#5d6d7e' } },
        buildings: { 'command-center': { name: '사령부', color: '#8b4513' }, 'supply-depot': { name: '보급고', color: '#6b5344' }, 'barracks': { name: '병영', color: '#654321' }, 'factory': { name: '공장', color: '#5d4e37' }, 'starport': { name: '우주공항', color: '#4a5568' }, 'science-facility': { name: '과학시설', color: '#3d4a5c' }, 'engineering-bay': { name: '공병부', color: '#5a4a3a' }, 'armory': { name: '무기고', color: '#554433' }, 'bunker': { name: '벙커', color: '#5d4e37' } }
    },
    zerg: {
        units: { drone: { name: '드론', color: '#9966aa' }, zergling: { name: '저글링', color: '#cc4466' }, hydralisk: { name: '히드라리스크', color: '#66aa44' }, ultralisk: { name: '울트라리스크', color: '#885522' }, mutalisk: { name: '뮤탈리스크', color: '#44aacc' }, overlord: { name: '오버로드', color: '#774466' } },
        buildings: { 'hatchery': { name: '부화장', color: '#553366' }, 'spawning-pool': { name: '번식지', color: '#442244' }, 'evolution-chamber': { name: '진화실', color: '#552244' }, 'hydralisk-den': { name: '히드라리스크 굴', color: '#663355' }, 'spire': { name: '둥지탑', color: '#442244' }, 'ultralisk-cavern': { name: '울트라리스크 동굴', color: '#663322' }, 'queen-nest': { name: '여왕 둥지', color: '#552233' }, 'nydus-canal': { name: '나이더스 관문', color: '#441122' } }
    },
    protoss: {
        units: { probe: { name: '프로브', color: '#ccaa44' }, zealot: { name: '질럿', color: '#4488cc' }, dragoon: { name: '드라군', color: '#8866cc' }, hightemplar: { name: '고위 기사', color: '#66aacc' }, darktemplar: { name: '암흑 기사', color: '#334466' }, reaver: { name: '리버', color: '#778899' } },
        buildings: { 'nexus': { name: '넥서스', color: '#334466' }, 'pylon': { name: '수정탑', color: '#556688' }, 'gateway': { name: '게이트웨이', color: '#445577' }, 'cybernetics-core': { name: '사이버네틱스 코어', color: '#446688' }, 'photon-cannon': { name: '광자포', color: '#6688aa' }, 'robotics-facility': { name: '로봇 공장', color: '#556688' }, 'stargate': { name: '성문', color: '#446699' }, 'citadel-of-adun': { name: '아둔의 성소', color: '#335577' }, 'templar-archives': { name: '기사단 기록관', color: '#446699' }, 'observatory': { name: '관측소', color: '#557799' } }
    }
};

// 종족별 시작 건물·일꾼·빌드 목록
var RACE_CONFIG = {
    terran: {
        mainBuilding: 'command-center',
        worker: 'scv',
        buildList: [
            // 유닛
            { type: 'scv', label: 'SCV' }, { type: 'marine', label: '마린' }, { type: 'firebat', label: '파이어뱃' }, { type: 'medic', label: '메딕' }, { type: 'ghost', label: '고스트' },
            { type: 'vulture', label: '벌처' }, { type: 'tank', label: '시즈 탱크' }, { type: 'goliath', label: '골리앗' },
            { type: 'wraith', label: '레이스' }, { type: 'dropship', label: '드랍십' }, { type: 'valkyrie', label: '발키리' }, { type: 'sciencevessel', label: '사이언스 베슬' }, { type: 'battlecruiser', label: '배틀크루저' },
            // 건물
            { type: 'command-center', label: '사령부' }, { type: 'supply-depot', label: '보급고' }, { type: 'refinery', label: '정제소' },
            { type: 'barracks', label: '병영' }, { type: 'academy', label: '아카데미' }, { type: 'factory', label: '공장' },
            { type: 'starport', label: '우주공항' }, { type: 'science-facility', label: '과학시설' }, { type: 'engineering-bay', label: '공병부' }, { type: 'armory', label: '무기고' },
            { type: 'missile-turret', label: '미사일 포탑' }, { type: 'bunker', label: '벙커' }
        ]
    },
    zerg: {
        mainBuilding: 'hatchery',
        worker: 'drone',
        buildList: [
            // 유닛
            { type: 'drone', label: '드론' }, { type: 'zergling', label: '저글링' }, { type: 'hydralisk', label: '히드라' }, { type: 'lurker', label: '러커' },
            { type: 'mutalisk', label: '뮤탈' }, { type: 'scourge', label: '스커지' }, { type: 'guardian', label: '가디언' }, { type: 'devourer', label: '디바우러' },
            { type: 'ultralisk', label: '울트라' }, { type: 'defiler', label: '디파일러' }, { type: 'queen', label: '퀸' }, { type: 'overlord', label: '오버로드' },
            // 건물
            { type: 'hatchery', label: '부화장' }, { type: 'lair', label: '레어' }, { type: 'hive', label: '하이브' },
            { type: 'spawning-pool', label: '번식지' }, { type: 'evolution-chamber', label: '진화실' }, { type: 'hydralisk-den', label: '히드라 굴' },
            { type: 'queen-nest', label: '여왕 둥지' }, { type: 'spire', label: '둥지탑' }, { type: 'greater-spire', label: '그레이터 스파이어' },
            { type: 'ultralisk-cavern', label: '울트라 동굴' }, { type: 'defiler-mound', label: '디파일러 마운드' },
            { type: 'nydus-canal', label: '나이더스' }, { type: 'creep-colony', label: '크립 콜로니' }, { type: 'sunken-colony', label: '선큰 콜로니' }, { type: 'spore-colony', label: '스포어 콜로니' }
        ]
    },
    protoss: {
        mainBuilding: 'nexus',
        worker: 'probe',
        buildList: [
            // 유닛
            { type: 'probe', label: '프로브' }, { type: 'zealot', label: '질럿' }, { type: 'dragoon', label: '드라군' },
            { type: 'hightemplar', label: '고위 기사' }, { type: 'darktemplar', label: '암흑 기사' }, { type: 'archon', label: '아콘' }, { type: 'darkarchon', label: '다크 아콘' },
            { type: 'reaver', label: '리버' }, { type: 'observer', label: '옵저버' }, { type: 'shuttle', label: '셔틀' },
            { type: 'corsair', label: '커세어' }, { type: 'carrier', label: '캐리어' }, { type: 'arbiter', label: '아비터' },
            // 건물
            { type: 'nexus', label: '넥서스' }, { type: 'pylon', label: '수정탑' }, { type: 'gateway', label: '게이트웨이' },
            { type: 'forge', label: '포지' }, { type: 'assimilator', label: '어시밀레이터' },
            { type: 'cybernetics-core', label: '사이버네틱스' }, { type: 'shield-battery', label: '실드 배터리' }, { type: 'photon-cannon', label: '광자포' },
            { type: 'robotics-facility', label: '로봇 공장' }, { type: 'robotics-support-bay', label: '로봇 지원소' },
            { type: 'stargate', label: '스타게이트' }, { type: 'fleet-beacon', label: '함대 신호소' },
            { type: 'citadel-of-adun', label: '아둔 성소' }, { type: 'templar-archives', label: '기사단 기록관' },
            { type: 'observatory', label: '관측소' }, { type: 'arbiter-tribunal', label: '아비터 법정' }
        ]
    }
};

function getUnitDisplay(unitType) {
    var race = gameState.playerRace || 'terran';
    var t = RACE_THEMES[race] && RACE_THEMES[race].units[unitType];
    return t || { name: unitTypes[unitType] ? unitTypes[unitType].name : unitType, color: (unitTypes[unitType] && unitTypes[unitType].color) || '#888' };
}

function getBuildingDisplay(buildingType) {
    var race = gameState.playerRace || 'terran';
    var t = RACE_THEMES[race] && RACE_THEMES[race].buildings[buildingType];
    return t || { name: buildingTypes[buildingType] ? buildingTypes[buildingType].name : buildingType, color: (buildingTypes[buildingType] && buildingTypes[buildingType].color) || '#666' };
}

// 스타크래프트 스타일 스프라이트 (SVG 데이터)
var unitSprites = {};
var buildingSprites = {};
// 애셋 이미지 (assets/unit 폴더) - 유닛 타입별 이미지 매칭
var unitAssetImages = {};
(function initUnitAssetImages() {
    for (var k in unitTypes) unitAssetImages[k] = null;
})();
(function loadUnitAssets() {
    var exts = ['jpg', 'png'];
    for (var type in unitTypes) {
        (function (unitType) {
            function tryLoad(extIdx) {
                if (extIdx >= exts.length) return;
                var img = new Image();
                img.onload = function() { unitAssetImages[unitType] = img; };
                img.onerror = function() { tryLoad(extIdx + 1); };
                img.src = 'assets/unit/' + unitType + '.' + exts[extIdx];
            }
            tryLoad(0);
        })(type);
    }
})();

// 건물 애셋 이미지 (모든 건물 타입 공통 로딩)
var buildingAssetImages = {};
(function loadBuildingAssets() {
    var exts = ['jpg', 'png'];
    for (var key in buildingTypes) {
        (function (bType) {
            function tryLoad(extIdx) {
                if (extIdx >= exts.length) return;
                var img = new Image();
                img.onload = function() { buildingAssetImages[bType] = img; };
                img.onerror = function() { tryLoad(extIdx + 1); };
                img.src = 'assets/building/' + bType + '.' + exts[extIdx];
            }
            buildingAssetImages[bType] = null;
            tryLoad(0);
        })(key);
    }
})();

var UNIT_SVG = {
    scv: '<circle cx="32" cy="32" r="14" fill="{{c}}"/><rect x="26" y="20" width="12" height="16" rx="2" fill="{{c2}}"/>',
    marine: '<circle cx="32" cy="28" r="10" fill="{{c}}"/><rect x="28" y="36" width="8" height="14" fill="{{c2}}"/>',
    firebat: '<circle cx="32" cy="28" r="10" fill="{{c}}"/><rect x="28" y="36" width="8" height="14" fill="{{c2}}"/><ellipse cx="32" cy="50" rx="8" ry="4" fill="{{c}}"/>',
    ghost: '<circle cx="32" cy="28" r="9" fill="{{c}}"/><rect x="29" y="36" width="6" height="12" fill="{{c2}}"/>',
    vulture: '<ellipse cx="32" cy="36" rx="18" ry="8" fill="{{c}}"/><rect x="24" y="28" width="16" height="12" fill="{{c2}}"/>',
    tank: '<rect x="14" y="24" width="36" height="20" rx="4" fill="{{c}}"/><circle cx="32" cy="32" r="8" fill="{{c2}}"/><rect x="30" y="14" width="4" height="14" fill="{{c}}"/>',
    goliath: '<rect x="20" y="28" width="24" height="16" rx="2" fill="{{c}}"/><circle cx="26" cy="36" r="5" fill="{{c2}}"/><circle cx="38" cy="36" r="5" fill="{{c2}}"/>',
    drone: '<ellipse cx="32" cy="34" rx="12" ry="14" fill="{{c}}"/><path d="M32 20 L28 28 L32 26 L36 28 Z" fill="{{c2}}"/>',
    zergling: '<ellipse cx="32" cy="36" rx="10" ry="12" fill="{{c}}"/>',
    hydralisk: '<ellipse cx="32" cy="32" rx="12" ry="14" fill="{{c}}"/><path d="M32 18 L28 28 L36 28 Z" fill="{{c2}}"/>',
    ultralisk: '<ellipse cx="32" cy="40" rx="24" ry="20" fill="{{c}}"/><path d="M4 28 Q2 40 8 52 L18 48 Q12 38 16 28 Z" fill="{{c2}}"/><path d="M60 28 Q62 40 56 52 L46 48 Q52 38 48 28 Z" fill="{{c2}}"/><ellipse cx="32" cy="38" rx="12" ry="10" fill="{{c2}}"/>',
    mutalisk: '<ellipse cx="32" cy="34" rx="14" ry="12" fill="{{c}}"/><path d="M18 30 Q10 34 18 38" fill="{{c2}}"/>',
    overlord: '<ellipse cx="32" cy="36" rx="22" ry="16" fill="{{c}}"/><ellipse cx="32" cy="32" rx="14" ry="10" fill="{{c2}}"/>',
    probe: '<circle cx="32" cy="32" r="12" fill="{{c}}"/><circle cx="32" cy="32" r="6" fill="{{c2}}"/>',
    zealot: '<path d="M32 16 L40 32 L32 48 L24 32 Z" fill="{{c}}"/>',
    dragoon: '<ellipse cx="32" cy="42" rx="18" ry="12" fill="{{c}}"/><path d="M16 46 L18 58 L22 58 L20 46 Z" fill="{{c2}}"/><path d="M48 46 L46 58 L42 58 L44 46 Z" fill="{{c2}}"/><path d="M24 48 L22 60 L26 60 L28 48 Z" fill="{{c2}}"/><path d="M40 48 L42 60 L38 60 L36 48 Z" fill="{{c2}}"/><rect x="28" y="10" width="8" height="28" rx="2" fill="{{c}}"/><ellipse cx="32" cy="8" rx="5" ry="4" fill="{{c2}}"/><circle cx="32" cy="24" r="4" fill="{{c2}}"/>',
    hightemplar: '<circle cx="32" cy="28" r="10" fill="{{c}}"/><path d="M32 38 L28 52 L36 52 Z" fill="{{c2}}"/>',
    darktemplar: '<path d="M32 18 L38 32 L32 46 L26 32 Z" fill="{{c}}"/>',
    reaver: '<ellipse cx="32" cy="36" rx="20" ry="12" fill="{{c}}"/><circle cx="32" cy="32" r="8" fill="{{c2}}"/>'
};
var BUILDING_SVG = {
    'command-center': '<rect x="4" y="8" width="56" height="48" rx="4" fill="{{c}}"/><rect x="12" y="16" width="20" height="24" fill="{{c2}}"/><rect x="32" y="16" width="20" height="24" fill="{{c2}}"/>',
    'supply-depot': '<rect x="14" y="24" width="36" height="28" rx="2" fill="{{c}}"/><rect x="20" y="30" width="24" height="14" fill="{{c2}}"/>',
    'barracks': '<rect x="8" y="12" width="48" height="40" fill="{{c}}"/><rect x="16" y="20" width="32" height="24" fill="{{c2}}"/>',
    'factory': '<rect x="6" y="14" width="52" height="36" rx="2" fill="{{c}}"/><rect x="14" y="22" width="36" height="20" fill="{{c2}}"/>',
    'starport': '<rect x="10" y="18" width="44" height="32" rx="2" fill="{{c}}"/><ellipse cx="32" cy="34" rx="14" ry="8" fill="{{c2}}"/><rect x="28" y="8" width="8" height="12" fill="{{c}}"/>',
    'science-facility': '<rect x="10" y="14" width="44" height="36" rx="2" fill="{{c}}"/><rect x="18" y="22" width="28" height="20" fill="{{c2}}"/><circle cx="32" cy="32" r="6" fill="{{c}}"/>',
    'engineering-bay': '<rect x="12" y="16" width="40" height="32" rx="2" fill="{{c}}"/><rect x="20" y="24" width="24" height="16" fill="{{c2}}"/>',
    'armory': '<rect x="14" y="18" width="36" height="28" rx="2" fill="{{c}}"/><rect x="22" y="26" width="20" height="12" fill="{{c2}}"/>',
    'bunker': '<rect x="16" y="20" width="32" height="28" rx="2" fill="{{c}}"/><rect x="22" y="26" width="20" height="14" fill="{{c2}}"/>',
    'hatchery': '<ellipse cx="32" cy="36" rx="26" ry="20" fill="{{c}}"/><path d="M16 36 Q32 20 48 36 Q32 52 16 36" fill="{{c2}}"/>',
    'spawning-pool': '<ellipse cx="32" cy="34" rx="22" ry="18" fill="{{c}}"/><ellipse cx="32" cy="34" rx="14" ry="10" fill="{{c2}}"/>',
    'evolution-chamber': '<rect x="10" y="18" width="44" height="28" rx="4" fill="{{c}}"/><circle cx="32" cy="32" r="8" fill="{{c2}}"/>',
    'hydralisk-den': '<path d="M8 48 L32 8 L56 48 Z" fill="{{c}}"/><path d="M16 42 L32 16 L48 42 Z" fill="{{c2}}"/>',
    'spire': '<path d="M32 8 L56 56 L8 56 Z" fill="{{c}}"/><ellipse cx="32" cy="40" rx="12" ry="10" fill="{{c2}}"/>',
    'ultralisk-cavern': '<ellipse cx="32" cy="38" rx="24" ry="18" fill="{{c}}"/><path d="M14 36 Q32 20 50 36 Q32 52 14 36" fill="{{c2}}"/>',
    'queen-nest': '<ellipse cx="32" cy="36" rx="22" ry="20" fill="{{c}}"/><ellipse cx="32" cy="34" rx="14" ry="12" fill="{{c2}}"/>',
    'nydus-canal': '<rect x="18" y="12" width="28" height="40" rx="4" fill="{{c}}"/><ellipse cx="32" cy="32" rx="10" ry="12" fill="{{c2}}"/>',
    'nexus': '<circle cx="32" cy="32" r="28" fill="{{c}}"/><circle cx="32" cy="32" r="18" fill="{{c2}}"/><path d="M32 4 L36 28 L32 32 L28 28 Z" fill="{{c}}"/>',
    'pylon': '<path d="M32 8 L52 56 L12 56 Z" fill="{{c}}"/><rect x="26" y="28" width="12" height="20" fill="{{c2}}"/>',
    'gateway': '<rect x="12" y="10" width="40" height="44" fill="{{c}}"/><rect x="20" y="18" width="24" height="28" fill="{{c2}}"/>',
    'cybernetics-core': '<rect x="14" y="14" width="36" height="36" rx="4" fill="{{c}}"/><circle cx="32" cy="32" r="12" fill="{{c2}}"/>',
    'photon-cannon': '<circle cx="32" cy="32" r="20" fill="{{c}}"/><circle cx="32" cy="32" r="10" fill="{{c2}}"/>',
    'robotics-facility': '<rect x="8" y="14" width="48" height="36" rx="2" fill="{{c}}"/><rect x="16" y="22" width="32" height="20" fill="{{c2}}"/>',
    'stargate': '<rect x="14" y="12" width="36" height="40" fill="{{c}}"/><ellipse cx="32" cy="32" rx="12" ry="14" fill="{{c2}}"/>',
    'citadel-of-adun': '<rect x="14" y="16" width="36" height="32" rx="4" fill="{{c}}"/><path d="M32 22 L38 36 L32 48 L26 36 Z" fill="{{c2}}"/>',
    'templar-archives': '<rect x="14" y="14" width="36" height="36" rx="4" fill="{{c}}"/><rect x="22" y="22" width="20" height="20" fill="{{c2}}"/>',
    'observatory': '<rect x="18" y="20" width="28" height="28" rx="4" fill="{{c}}"/><circle cx="32" cy="34" r="8" fill="{{c2}}"/>'
};
function darken(c, p) { var n = parseInt(c.slice(1), 16), r = Math.max(0, (n >> 16) - 40), g = Math.max(0, ((n >> 8) & 255) - 40), b = Math.max(0, (n & 255) - 40); return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0'); }
function getUnitSvgDataUri(type) {
    var u = unitTypes[type]; if (!u || !UNIT_SVG[type]) return ''; var c = u.color || '#888'; var c2 = darken(c, 0.3);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + UNIT_SVG[type].replace(/\{\{c\}\}/g, c).replace(/\{\{c2\}\}/g, c2) + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function getBuildingSvgDataUri(type) {
    var b = buildingTypes[type]; if (!b || !BUILDING_SVG[type]) return ''; var c = b.color || '#666'; var c2 = darken(c, 0.25);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + BUILDING_SVG[type].replace(/\{\{c\}\}/g, c).replace(/\{\{c2\}\}/g, c2) + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function loadAllSprites() {
    var k; for (k in unitTypes) if (UNIT_SVG[k]) { var img = new Image(); img.src = getUnitSvgDataUri(k); unitSprites[k] = img; }
    for (k in buildingTypes) if (BUILDING_SVG[k]) { var img = new Image(); img.src = getBuildingSvgDataUri(k); buildingSprites[k] = img; }
}
loadAllSprites();

// 유닛 클래스
class Unit {
    constructor(x, y, type, team = 'player') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.data = unitTypes[type];
        this.hp = this.data.hp;
        this.maxHp = this.data.maxHp;
        this.targetX = x;
        this.targetY = y;
        this.selected = false;
        this.attacking = null;
        this.attackingBuilding = null;
        this.id = Math.random().toString(36).substr(2, 9);
        this.team = team;
        this.miningTarget = null;
        this.carryingMinerals = 0;
        this.carryingGas = 0;
        this.depot = null;
        this.minePhase = 'idle';
        this.mineTimer = 0;
        this.insideBunker = null;
    }

    update() {
        if (this.insideBunker) return;
        // 이동
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
            this.x += (dx / dist) * this.data.speed;
            this.y += (dy / dist) * this.data.speed;
        }

        // SCV 미네랄/가스 채굴 (플레이어)
        if (this.team === 'player' && this.data.canMine) {
            this.updateMining();
            if (this.minePhase !== 'idle' && this.minePhase !== 'to_mineral' && this.minePhase !== 'to_depot') {
                return;
            }
        }

        // 적 SCV 채굴 (상대방도 미네랄/가스 채굴)
        if (this.team === 'enemy' && this.data.canMine) {
            this.updateEnemyMining();
            if (this.minePhase !== 'idle' && this.minePhase !== 'to_mineral' && this.minePhase !== 'to_depot') {
                return;
            }
        }

        // 공격 로직 (유닛)
        if (this.data.canAttack && this.attacking) {
            const dx = this.attacking.x - this.x;
            const dy = this.attacking.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > this.data.range * 20) {
                this.targetX = this.attacking.x;
                this.targetY = this.attacking.y;
            } else {
                this.attacking.hp -= this.data.attack * 0.1;
                if (this.attacking.hp <= 0) {
                    if (this.attacking.team === 'player') {
                        const index = gameState.units.indexOf(this.attacking);
                        if (index > -1) {
                            var d = this.attacking.data;
                            gameState.supply.current -= (d.supply || 0);
                            if (d.supplyProvided) gameState.supply.max -= d.supplyProvided;
                            gameState.units.splice(index, 1);
                        }
                    } else {
                        const index = gameState.enemyUnits.indexOf(this.attacking);
                        if (index > -1) {
                            gameState.enemySupply.current -= this.attacking.data.supply;
                            gameState.enemyUnits.splice(index, 1);
                        }
                    }
                    this.attacking = null;
                }
            }
        } else if (this.data.canAttack && this.attackingBuilding && this.team === 'player') {
            var b = this.attackingBuilding;
            if (gameState.enemyBuildings.indexOf(b) === -1) {
                this.attackingBuilding = null;
                return;
            }
            var bdx = b.x - this.x;
            var bdy = b.y - this.y;
            var bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            var range = this.data.range * 20;
            if (bdist > range) {
                this.targetX = b.x;
                this.targetY = b.y;
            } else {
                b.hp -= this.data.attack * 0.08;
                if (b.hp <= 0) {
                    var idx = gameState.enemyBuildings.indexOf(b);
                    if (idx > -1) gameState.enemyBuildings.splice(idx, 1);
                    this.attackingBuilding = null;
                }
            }
        } else if (this.data.canAttack && !this.attacking && !this.attackingBuilding && this.team === 'player') {
            var range = this.data.range * 25;
            // 플레이어 유닛이 적 유닛을 자동으로 찾아서 공격
            var nearestEnemy = gameState.enemyUnits.find(function(enemy) {
                var dx = enemy.x - this.x;
                var dy = enemy.y - this.y;
                return Math.sqrt(dx * dx + dy * dy) < range;
            }, this);
            if (nearestEnemy) {
                this.attack(nearestEnemy);
            } else {
                // 근처 적 건물이 있으면 자동으로 공격
                var nearestBuilding = null;
                var nearestDist = range;
                for (var i = 0; i < gameState.enemyBuildings.length; i++) {
                    var b = gameState.enemyBuildings[i];
                    var bdx = b.x - this.x;
                    var bdy = b.y - this.y;
                    var d = Math.sqrt(bdx * bdx + bdy * bdy);
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearestBuilding = b;
                    }
                }
                if (nearestBuilding) this.attackingBuilding = nearestBuilding;
            }
        }
    }

    draw() {
        if (this.insideBunker) return;
        const screenX = this.x - gameState.camera.x;
        const screenY = this.y - gameState.camera.y;

        // 선택 표시 (맵과 어울리게 부드러운 테두리)
        if (this.selected) {
            ctx.strokeStyle = 'rgba(120, 220, 100, 0.9)';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(100, 255, 80, 0.5)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.data.size + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // 유닛 그림자 (맵 위에서 자연스럽게)
        var size = this.data.size * 2.2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + size * 0.4, size * 0.9, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 유닛 그리기: 애셋 이미지(SCV, 마린 등) 우선, 그 외 스프라이트 또는 원
        var useImg = null;
        if (unitAssetImages[this.type] && unitAssetImages[this.type].complete && unitAssetImages[this.type].naturalWidth) {
            useImg = unitAssetImages[this.type];
        } else {
            var img = unitSprites[this.type];
            if (img && img.complete && img.naturalWidth) useImg = img;
        }
        if (useImg) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.drawImage(useImg, -size, -size, size * 2, size * 2);
            if (this.team === 'enemy') {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = '#ff4444';
                ctx.fillRect(-size, -size, size * 2, size * 2);
            }
            ctx.restore();
        } else {
            var color = this.team === 'player' ? getUnitDisplay(this.type).color : '#c03030';
            ctx.strokeStyle = this.team === 'player' ? 'rgba(255,255,255,0.25)' : 'rgba(255,100,100,0.5)';
            ctx.lineWidth = 1;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.data.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // HP 바 (맵과 대비되도록 살짝 테두리)
        if (this.hp < this.maxHp) {
            const barWidth = this.data.size * 2;
            const barHeight = 4;
            const hpPercent = this.hp / this.maxHp;
            const barY = screenY - this.data.size - 8;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);
            ctx.fillStyle = 'rgba(80,30,30,0.9)';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);
            ctx.fillStyle = 'rgba(80, 200, 60, 0.95)';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth * hpPercent, barHeight);
        }
    }

    // 적 SCV 전용: 적 기지 근처 자원만 채굴 → 적 자원에 반납
    updateEnemyMining() {
        var enemyCC = gameState.enemyBuildings.find(function(b) { return b.type === 'command-center'; });
        if (!enemyCC) return;
        var baseDist = 380;
        function nearEnemyBase(r) {
            var dx = r.x - ENEMY_BASE_X;
            var dy = r.y - ENEMY_BASE_Y;
            return (dx * dx + dy * dy) < baseDist * baseDist;
        }
        if (this.minePhase === 'idle') {
            if (this.miningTarget) return;
            var best = null;
            var bestDist = 1e9;
            for (var i = 0; i < gameState.resources.length; i++) {
                var r = gameState.resources[i];
                if ((r.type !== 'mineral' && r.type !== 'gas') || r.amount <= 0 || !nearEnemyBase(r)) continue;
                var d = (this.x - r.x) * (this.x - r.x) + (this.y - r.y) * (this.y - r.y);
                if (d < bestDist) { bestDist = d; best = r; }
            }
            if (best) {
                this.miningTarget = best;
                this.depot = enemyCC;
                this.targetX = best.x;
                this.targetY = best.y;
                this.minePhase = 'to_mineral';
            }
            return;
        }
        if (this.minePhase === 'to_mineral' && this.miningTarget) {
            var d = Math.sqrt((this.x - this.miningTarget.x) * (this.x - this.miningTarget.x) + (this.y - this.miningTarget.y) * (this.y - this.miningTarget.y));
            if (d < 35) {
                this.minePhase = 'mining';
                this.mineTimer = 45;
            }
            return;
        }
        if (this.minePhase === 'mining') {
            this.mineTimer--;
            if (this.mineTimer <= 0) {
                if (this.miningTarget.type === 'gas') {
                    var takeG = Math.min(8, this.miningTarget.amount);
                    this.miningTarget.amount -= takeG;
                    this.carryingGas = takeG;
                } else {
                    var take = Math.min(8, this.miningTarget.amount);
                    this.miningTarget.amount -= take;
                    this.carryingMinerals = take;
                }
                this.targetX = this.depot.x;
                this.targetY = this.depot.y;
                this.minePhase = 'to_depot';
                if (this.miningTarget.amount <= 0) this.miningTarget = null;
            }
            return;
        }
        if (this.minePhase === 'to_depot' && this.depot) {
            var d = Math.sqrt((this.x - this.depot.x) * (this.x - this.depot.x) + (this.y - this.depot.y) * (this.y - this.depot.y));
            if (d < 55) {
                this.minePhase = 'depositing';
                this.mineTimer = 20;
            }
            return;
        }
        if (this.minePhase === 'depositing') {
            this.mineTimer--;
            if (this.mineTimer <= 0) {
                gameState.enemyMinerals += this.carryingMinerals;
                gameState.enemyGas += this.carryingGas;
                this.carryingMinerals = 0;
                this.carryingGas = 0;
                if (this.miningTarget && this.miningTarget.amount > 0) {
                    this.targetX = this.miningTarget.x;
                    this.targetY = this.miningTarget.y;
                    this.minePhase = 'to_mineral';
                } else {
                    this.miningTarget = null;
                    this.minePhase = 'idle';
                }
            }
        }
    }

    moveTo(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.attacking = null;
        this.attackingBuilding = null;
        this.miningTarget = null;
        this.depot = null;
        this.minePhase = 'idle';
    }

    attack(target) {
        this.attacking = target;
    }

    // 미네랄 채굴 명령 (우클릭 자원)
    startMining(resource, depotBuilding) {
        if (!this.data.canMine || this.team !== 'player') return;
        this.miningTarget = resource;
        this.depot = depotBuilding;
        this.targetX = resource.x;
        this.targetY = resource.y;
        this.minePhase = 'to_mineral';
        this.attacking = null;
    }

    updateMining() {
        if (this.minePhase === 'idle') {
            // idle 상태에서는 자동으로 자원을 찾지 않고,
            // 플레이어가 우클릭으로 채굴 명령을 내렸을 때만 동작한다.
            return;
        }

        if (this.minePhase === 'to_mineral' && this.miningTarget) {
            var d = Math.sqrt((this.x - this.miningTarget.x) * (this.x - this.miningTarget.x) + (this.y - this.miningTarget.y) * (this.y - this.miningTarget.y));
            if (d < 35) {
                this.minePhase = 'mining';
                this.mineTimer = 45;
            }
            return;
        }

        if (this.minePhase === 'mining') {
            this.mineTimer--;
            if (this.mineTimer <= 0) {
                if (this.miningTarget.type === 'gas') {
                    var takeG = Math.min(8, this.miningTarget.amount);
                    this.miningTarget.amount -= takeG;
                    this.carryingGas = takeG;
                } else {
                    var take = Math.min(8, this.miningTarget.amount);
                    this.miningTarget.amount -= take;
                    this.carryingMinerals = take;
                }
                this.targetX = this.depot.x;
                this.targetY = this.depot.y;
                this.minePhase = 'to_depot';
                if (this.miningTarget.amount <= 0) this.miningTarget = null;
            }
            return;
        }

        if (this.minePhase === 'to_depot' && this.depot) {
            var d = Math.sqrt((this.x - this.depot.x) * (this.x - this.depot.x) + (this.y - this.depot.y) * (this.y - this.depot.y));
            if (d < 55) {
                this.minePhase = 'depositing';
                this.mineTimer = 20;
            }
            return;
        }

        if (this.minePhase === 'depositing') {
            this.mineTimer--;
            if (this.mineTimer <= 0) {
                gameState.minerals += this.carryingMinerals;
                gameState.gas += this.carryingGas;
                this.carryingMinerals = 0;
                this.carryingGas = 0;
                updateResources();
                if (this.miningTarget && this.miningTarget.amount > 0) {
                    this.targetX = this.miningTarget.x;
                    this.targetY = this.miningTarget.y;
                    this.minePhase = 'to_mineral';
                } else {
                    this.miningTarget = null;
                    this.minePhase = 'idle';
                }
            }
        }
    }
}

// 벙커 수용 인원
const BUNKER_CAPACITY = 4;

// 최대 보급(인구) 수
const MAX_SUPPLY = 200;

// 건물 클래스
class Building {
    constructor(x, y, type, team = 'player') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.data = buildingTypes[type];
        this.hp = this.data.maxHp;
        this.maxHp = this.data.maxHp;
        this.selected = false;
        this.id = Math.random().toString(36).substr(2, 9);
        this.team = team;
        this.garrison = (type === 'bunker') ? [] : null;
    }

    draw() {
        const screenX = this.x - gameState.camera.x;
        const screenY = this.y - gameState.camera.y;
        var bsize = this.data.size;

        // 건물 그림자 (맵 위에서 자연스럽게)
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + bsize * 0.3, bsize * 0.6, bsize * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 선택 표시 (맵과 어울리게)
        if (this.selected) {
            ctx.strokeStyle = 'rgba(120, 220, 100, 0.9)';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(100, 255, 80, 0.4)';
            ctx.shadowBlur = 6;
            ctx.strokeRect(
                screenX - bsize / 2 - 5,
                screenY - bsize / 2 - 5,
                bsize + 10,
                bsize + 10
            );
            ctx.shadowBlur = 0;
        }

        // 건물 그리기 (애셋 이미지 우선 → 스프라이트 → 사각형)
        var useBuildingImg = buildingAssetImages[this.type] && buildingAssetImages[this.type].complete && buildingAssetImages[this.type].naturalWidth
            ? buildingAssetImages[this.type]
            : null;
        if (!useBuildingImg) {
            var bimg = buildingSprites[this.type];
            if (bimg && bimg.complete && bimg.naturalWidth) useBuildingImg = bimg;
        }
        if (useBuildingImg) {
            ctx.save();
            ctx.drawImage(useBuildingImg, screenX - bsize / 2, screenY - bsize / 2, bsize, bsize);
            if (this.team === 'enemy') {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = '#aa2222';
                ctx.fillRect(screenX - bsize / 2, screenY - bsize / 2, bsize, bsize);
                ctx.restore();
                ctx.strokeStyle = 'rgba(200, 60, 60, 0.9)';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX - bsize / 2, screenY - bsize / 2, bsize, bsize);
            } else ctx.restore();
        } else {
            var bcolor = this.team === 'player' ? getBuildingDisplay(this.type).color : '#6b2020';
            ctx.strokeStyle = this.team === 'player' ? 'rgba(255,255,255,0.2)' : 'rgba(255,100,100,0.4)';
            ctx.lineWidth = 1;
            ctx.fillStyle = bcolor;
            ctx.fillRect(screenX - bsize / 2, screenY - bsize / 2, bsize, bsize);
            ctx.strokeRect(screenX - bsize / 2, screenY - bsize / 2, bsize, bsize);
        }

        // HP 바 (맵과 대비되도록)
        if (this.hp < this.maxHp) {
            const barWidth = this.data.size;
            const barHeight = 6;
            const hpPercent = this.hp / this.maxHp;
            const barY = screenY - this.data.size / 2 - 12;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);
            ctx.fillStyle = 'rgba(80,30,30,0.9)';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);
            ctx.fillStyle = 'rgba(80, 200, 60, 0.95)';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth * hpPercent, barHeight);
        }
    }
}

// 한 덩어리당 최대 자원량 (10만)
var MAX_RESOURCE_AMOUNT = 100000;

// 맵 위 미네랄/가스 표시용 애셋 이미지
var resourceNodeImages = { mineral: null, gas: null };
(function loadResourceNodeImages() {
    var m = new Image();
    m.onload = function() { resourceNodeImages.mineral = m; };
    m.onerror = function() { m.src = 'assets/mineral.png'; };
    m.src = 'assets/mineral.jpg';
    var g = new Image();
    g.onload = function() { resourceNodeImages.gas = g; };
    g.onerror = function() { g.src = 'assets/gas.png'; };
    g.src = 'assets/gas.jpg';
})();

// 맵 배경 이미지
var mapImage = null;
(function loadMapImage() {
    var img = new Image();
    img.onload = function() { mapImage = img; };
    img.src = 'assets/map.jpg';
})();

// 자원 클래스 (미네랄 20x20, 가스 30x20)
class Resource {
    constructor(x, y, type = 'mineral') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.amount = (type === 'mineral' || type === 'gas') ? MAX_RESOURCE_AMOUNT : 250;
        if (type === 'mineral') {
            this.sizeW = 20;
            this.sizeH = 20;
        } else if (type === 'gas') {
            this.sizeW = 30;
            this.sizeH = 20;
        } else {
            this.sizeW = 25;
            this.sizeH = 25;
        }
    }

    draw() {
        if (this.amount <= 0) return;
        const screenX = this.x - gameState.camera.x;
        const screenY = this.y - gameState.camera.y;
        var w = this.sizeW;
        var h = this.sizeH;
        var img = null;
        if (this.type === 'mineral') {
            img = document.querySelector('img.resource-icon.mineral') || resourceNodeImages.mineral;
        } else if (this.type === 'gas') {
            img = document.querySelector('img.resource-icon.gas') || resourceNodeImages.gas;
        }

        // 자원 그림자 (맵 위에서 구분되도록)
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + h * 0.3, w * 0.8, h * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (img && img.complete && img.naturalWidth) {
            ctx.drawImage(img, screenX - w / 2, screenY - h / 2, w, h);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX - w / 2, screenY - h / 2, w, h);
        } else {
            if (this.type === 'mineral') {
                ctx.fillStyle = 'rgba(65, 105, 225, 0.95)';
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (this.type === 'gas') {
                ctx.fillStyle = 'rgba(0, 206, 209, 0.95)';
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        if (this.type === 'gas') ctx.fillText('가스 ' + this.amount, screenX, screenY + h / 2 + 12);
        else ctx.fillText(String(this.amount), screenX, screenY + h / 2 + 12);
    }
}

// 초기 자원 생성: 미네랄 10덩어리, 가스 2개 (한 덩어리당 최대 10만)
function initResources() {
    gameState.resources = [];
    var mineralAngles = [0, 72, 144, 216, 288];
    for (var i = 0; i < 5; i++) {
        var rad = (mineralAngles[i] * Math.PI) / 180;
        var dist = 130 + (i % 2) * 25;
        gameState.resources.push(new Resource(
            PLAYER_BASE_X + Math.cos(rad) * dist,
            PLAYER_BASE_Y + Math.sin(rad) * dist,
            'mineral'
        ));
    }
    for (var j = 0; j < 5; j++) {
        var r = (mineralAngles[j] * Math.PI) / 180;
        var d = 130 + (j % 2) * 25;
        gameState.resources.push(new Resource(
            ENEMY_BASE_X + Math.cos(r) * d,
            ENEMY_BASE_Y + Math.sin(r) * d,
            'mineral'
        ));
    }
    gameState.resources.push(new Resource(PLAYER_BASE_X + 200, PLAYER_BASE_Y, 'gas'));
    gameState.resources.push(new Resource(ENEMY_BASE_X - 200, ENEMY_BASE_Y, 'gas'));
}

// 초기 건물 생성 (종족별)
function initBuildings() {
    var cfg = RACE_CONFIG[gameState.playerRace] || RACE_CONFIG.terran;
    gameState.buildings.push(new Building(PLAYER_BASE_X, PLAYER_BASE_Y, cfg.mainBuilding, 'player'));
    gameState.enemyBuildings.push(new Building(ENEMY_BASE_X, ENEMY_BASE_Y, 'command-center', 'enemy'));
}

// 초기 유닛 생성 (종족별)
function initUnits() {
    var cfg = RACE_CONFIG[gameState.playerRace] || RACE_CONFIG.terran;
    for (var i = 0; i < 5; i++) {
        gameState.units.push(new Unit(PLAYER_BASE_X + 50 + i * 30, PLAYER_BASE_Y + 50, cfg.worker, 'player'));
    }
    // 상대방은 처음에 일꾼(SCV)만 보유, 공격 유닛 없음
    var enemySupplyCount = 0;
    for (let i = 0; i < 3; i++) {
        gameState.enemyUnits.push(new Unit(
            ENEMY_BASE_X - 60 + i * 28,
            ENEMY_BASE_Y - 120,
            'scv',
            'enemy'
        ));
        enemySupplyCount += 1;
    }
    gameState.enemySupply.current = enemySupplyCount;
}

// 적 유닛 생성 (상대방도 캐릭터 생산)
function createEnemyUnit(type) {
    var unitData = unitTypes[type];
    if (!unitData) return false;
    if (gameState.enemyMinerals < unitData.cost.minerals || gameState.enemyGas < unitData.cost.gas) return false;
    if (gameState.enemySupply.current + unitData.supply > gameState.enemySupply.max) return false;
    gameState.enemyMinerals -= unitData.cost.minerals;
    gameState.enemyGas -= unitData.cost.gas;
    gameState.enemySupply.current += unitData.supply;
    var bx = ENEMY_BASE_X - 80 - gameState.enemyUnits.length * 20;
    var by = ENEMY_BASE_Y - 60 - (gameState.enemyUnits.length % 2) * 30;
    gameState.enemyUnits.push(new Unit(bx, by, type, 'enemy'));
    return true;
}

// 적 건물 건설
function buildEnemyBuilding(type) {
    var bd = buildingTypes[type];
    if (!bd || gameState.enemyMinerals < bd.cost.minerals || gameState.enemyGas < bd.cost.gas) return false;
    gameState.enemyMinerals -= bd.cost.minerals;
    gameState.enemyGas -= bd.cost.gas;
    var ox = ENEMY_BASE_X - 150 - gameState.enemyBuildings.length * 70;
    var oy = ENEMY_BASE_Y - 100;
    var b = new Building(ox, oy, type, 'enemy');
    gameState.enemyBuildings.push(b);
    // 적도 보급고/오버로드 등의 보급 건물 효과를 받도록 처리
    if (bd.supplyProvided) {
        gameState.enemySupply.max += bd.supplyProvided;
        if (gameState.enemySupply.max > MAX_SUPPLY) gameState.enemySupply.max = MAX_SUPPLY;
    }
    return true;
}

// 적 AI: 주기적으로 자원 증가 + 건물/유닛 생산 (생산 속도 완화)
function runEnemyAI() {
    // 기본 자원 수급
    gameState.enemyMinerals += 8;
    gameState.enemyGas += 1;

    var hasBarracks = gameState.enemyBuildings.some(function(b) { return b.type === 'barracks'; });
    var hasFactory  = gameState.enemyBuildings.some(function(b) { return b.type === 'factory'; });
    var hasStarport = gameState.enemyBuildings.some(function(b) { return b.type === 'starport'; });

    var depotCount = gameState.enemyBuildings.filter(function(b) { return b.type === 'supply-depot'; }).length;
    var barracksCount = gameState.enemyBuildings.filter(function(b) { return b.type === 'barracks'; }).length;
    var factoryCount  = gameState.enemyBuildings.filter(function(b) { return b.type === 'factory'; }).length;

    // 1) 보급 한계에 가까워지면 보급고 건설
    if (gameState.enemySupply.current + 4 >= gameState.enemySupply.max &&
        gameState.enemySupply.max < MAX_SUPPLY &&
        gameState.enemyMinerals >= buildingTypes['supply-depot'].cost.minerals &&
        Math.random() < 0.7) {
        if (buildEnemyBuilding('supply-depot')) return;
    }

    // 2) 기본 건물 확보: 병영 → 공장 → 스타포트 순서로 확보
    if (!hasBarracks && gameState.enemyMinerals >= buildingTypes['barracks'].cost.minerals) {
        if (buildEnemyBuilding('barracks')) return;
    }
    if (hasBarracks && !hasFactory &&
        gameState.enemyMinerals >= buildingTypes['factory'].cost.minerals &&
        gameState.enemyGas      >= buildingTypes['factory'].cost.gas) {
        if (buildEnemyBuilding('factory')) return;
    }
    if (hasFactory && !hasStarport &&
        gameState.enemyMinerals >= buildingTypes['starport'].cost.minerals &&
        gameState.enemyGas      >= buildingTypes['starport'].cost.gas &&
        Math.random() < 0.4) {
        if (buildEnemyBuilding('starport')) return;
    }

    // 3) 추가 병영/공장 확장 (게임 진행 시간이 지날수록 더 많이)
    if (hasBarracks && barracksCount < 2 &&
        gameState.totalFrames > 2000 &&
        gameState.enemyMinerals >= buildingTypes['barracks'].cost.minerals &&
        Math.random() < 0.4) {
        if (buildEnemyBuilding('barracks')) return;
    }
    if (hasFactory && factoryCount < 2 &&
        gameState.totalFrames > 3000 &&
        gameState.enemyMinerals >= buildingTypes['factory'].cost.minerals &&
        gameState.enemyGas      >= buildingTypes['factory'].cost.gas &&
        Math.random() < 0.35) {
        if (buildEnemyBuilding('factory')) return;
    }

    // 4) 유닛 생산 (병영 / 공장 위주)
    if (hasBarracks) {
        // 병영 유닛: 마린 중심, 가스 여유 시 파이어뱃/고스트
        if (gameState.enemyMinerals >= unitTypes.marine.cost.minerals &&
            gameState.enemySupply.current + unitTypes.marine.supply <= gameState.enemySupply.max &&
            Math.random() < 0.5) {
            if (createEnemyUnit('marine')) return;
        }
        if (gameState.enemyMinerals >= unitTypes.firebat.cost.minerals &&
            gameState.enemyGas      >= unitTypes.firebat.cost.gas &&
            gameState.enemySupply.current + unitTypes.firebat.supply <= gameState.enemySupply.max &&
            Math.random() < 0.25) {
            if (createEnemyUnit('firebat')) return;
        }
        if (gameState.enemyMinerals >= unitTypes.ghost.cost.minerals &&
            gameState.enemyGas      >= unitTypes.ghost.cost.gas &&
            gameState.enemySupply.current + unitTypes.ghost.supply <= gameState.enemySupply.max &&
            Math.random() < 0.15) {
            if (createEnemyUnit('ghost')) return;
        }
    }

    if (hasFactory) {
        // 공장 유닛: 벌처/탱크/골리앗
        if (gameState.enemyMinerals >= unitTypes.vulture.cost.minerals &&
            gameState.enemySupply.current + unitTypes.vulture.supply <= gameState.enemySupply.max &&
            Math.random() < 0.35) {
            if (createEnemyUnit('vulture')) return;
        }
        if (gameState.enemyMinerals >= unitTypes.tank.cost.minerals &&
            gameState.enemyGas      >= unitTypes.tank.cost.gas &&
            gameState.enemySupply.current + unitTypes.tank.supply <= gameState.enemySupply.max &&
            Math.random() < 0.25) {
            if (createEnemyUnit('tank')) return;
        }
        if (gameState.enemyMinerals >= unitTypes.goliath.cost.minerals &&
            gameState.enemyGas      >= unitTypes.goliath.cost.gas &&
            gameState.enemySupply.current + unitTypes.goliath.supply <= gameState.enemySupply.max &&
            Math.random() < 0.2) {
            if (createEnemyUnit('goliath')) return;
        }
    }
}

// 유닛 선택
function selectUnits(x, y, isBox = false, boxEndX = null, boxEndY = null) {
    gameState.selectedUnits.forEach(unit => unit.selected = false);
    gameState.selectedUnits = [];

    const worldX = x + gameState.camera.x;
    const worldY = y + gameState.camera.y;

    if (isBox) {
        const minX = Math.min(x, boxEndX);
        const maxX = Math.max(x, boxEndX);
        const minY = Math.min(y, boxEndY);
        const maxY = Math.max(y, boxEndY);

        gameState.units.forEach(unit => {
            const screenX = unit.x - gameState.camera.x;
            const screenY = unit.y - gameState.camera.y;
            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
                unit.selected = true;
                gameState.selectedUnits.push(unit);
            }
        });
    } else {
        // 단일 클릭 선택
        let found = false;
        gameState.units.forEach(unit => {
            const dx = unit.x - worldX;
            const dy = unit.y - worldY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < unit.data.size && !found) {
                unit.selected = true;
                gameState.selectedUnits.push(unit);
                found = true;
            }
        });

        // 건물 선택
        if (!found) {
            gameState.buildings.forEach(building => {
                building.selected = false;
                const dx = building.x - worldX;
                const dy = building.y - worldY;
                if (Math.abs(dx) < building.data.size / 2 && Math.abs(dy) < building.data.size / 2) {
                    building.selected = true;
                    found = true;
                }
            });
        }
    }

    updateInfoPanel();

    // 선택 시 소리
    if ((gameState.selectedUnits.length > 0 || gameState.buildings.some(b => b.selected)) && typeof Sound !== 'undefined') {
        Sound.select();
    }
}

// 정보 패널 업데이트
function updateInfoPanel() {
    const infoPanel = document.getElementById('selected-info');
    infoPanel.innerHTML = '';

    if (gameState.selectedUnits.length > 0) {
        const unit = gameState.selectedUnits[0];
        infoPanel.innerHTML = `
            <div class="unit-info">
                <div class="unit-name">${unit.team === 'player' ? getUnitDisplay(unit.type).name : unit.data.name}</div>
                <div class="unit-stats">
                    <div class="stat">❤️ ${Math.ceil(unit.hp)}/${unit.maxHp}</div>
                    ${unit.data.attack ? `<div class="stat">⚔️ 공격력: ${unit.data.attack}</div>` : ''}
                    ${unit.data.canMine ? '<div class="stat">⛏️ 채굴 가능</div>' : ''}
                </div>
            </div>
        `;
    } else if (gameState.buildings.some(b => b.selected)) {
        const building = gameState.buildings.find(b => b.selected);
        var garrisonText = (building.garrison && building.type === 'bunker') ? `<div class="stat">🚪 수용: ${building.garrison.length}/${BUNKER_CAPACITY}</div>` : '';
        infoPanel.innerHTML = `
            <div class="unit-info">
                <div class="unit-name">${building.team === 'player' ? getBuildingDisplay(building.type).name : building.data.name}</div>
                <div class="unit-stats">
                    <div class="stat">❤️ ${Math.ceil(building.hp)}/${building.maxHp}</div>
                    ${garrisonText}
                    ${building.data.canTrain ? `<div class="stat">🏭 훈련: ${building.data.canTrain.join(', ')}</div>` : ''}
                </div>
            </div>
        `;
    }

    // 선택 상태에 따라 우측 빌드 패널(유닛/건물 버튼)도 갱신
    updateBuildPanel();
}

// 선택된 대상에 따라 빌드 패널(유닛/건물 버튼) 갱신
function updateBuildPanel() {
    var panel = document.getElementById('build-panel');
    if (!panel) return;
    panel.innerHTML = '';

    // 1) 먼저 플레이어 건물이 선택되어 있으면: 그 건물에서 훈련 가능한 유닛 버튼만 표시
    var selectedBuilding = gameState.buildings.find(function(b) { return b.selected && b.team === 'player'; });
    if (selectedBuilding) {
        var bData = buildingTypes[selectedBuilding.type];
        // (1) 유닛 훈련 버튼
        if (bData && bData.canTrain && bData.canTrain.length) {
            bData.canTrain.forEach(function(unitType) {
                var uData = unitTypes[unitType];
                if (!uData) return;
                var btn = document.createElement('button');
                btn.className = 'build-btn';
                btn.setAttribute('data-unit', unitType);
                btn.textContent = getUnitDisplay(unitType).name || uData.name || unitType;
                btn.onclick = function() {
                    if (typeof Sound !== 'undefined') Sound.click();
                    // 선택된 건물에서 바로 해당 유닛을 생산
                    createUnit(unitType, selectedBuilding.x + 55, selectedBuilding.y);
                };
                panel.appendChild(btn);
            });
        }

        // (2) 업그레이드 버튼
        var ups = buildingUpgrades[selectedBuilding.type];
        if (ups && ups.length) {
            ups.forEach(function(up) {
                var btn = document.createElement('button');
                btn.className = 'build-btn';
                btn.textContent = up.label;
                var level = gameState.upgrades[up.id] || 0;
                if (level > 0) {
                    btn.disabled = true;
                    btn.textContent = up.label + ' (완료)';
                }
                btn.onclick = function() {
                    if (btn.disabled) return;
                    if (typeof Sound !== 'undefined') Sound.click();
                    performUpgrade(up, btn);
                };
                panel.appendChild(btn);
            });
        }
        return;
    }

    // 2) 건물이 선택되어 있지 않다면, 빌드 가능한 일꾼(SCV/드론/프로브 등)이 선택된 경우에만
    //    종족별 건물 건설 버튼을 보여준다.
    var builder = gameState.selectedUnits.find(function(u) { return u.team === 'player' && u.data && u.data.canBuild; });
    if (builder) {
        var cfg = RACE_CONFIG[gameState.playerRace] || RACE_CONFIG.terran;
        var list = cfg.buildList || [];
        list.forEach(function(item) {
            // 건물 타입만 필터 (유닛은 여기서 제외)
            if (!buildingTypes[item.type]) return;
            var btn = document.createElement('button');
            btn.className = 'build-btn';
            btn.setAttribute('data-unit', item.type);
            btn.textContent = getBuildingDisplay(item.type).name || item.label || item.type;
            btn.onclick = function() {
                if (typeof Sound !== 'undefined') Sound.click();
                // 기존처럼 건설 모드 활성화 → 맵에 위치 지정 후 배치
                gameState.buildMode = item.type;
            };
            panel.appendChild(btn);
        });
        return;
    }

    // 3) 그 외(일반 유닛만 선택/아무것도 선택 안 함)인 경우에는 패널을 비워 둔다.
}

// 자원 업데이트
function updateResources() {
    document.getElementById('minerals').textContent = gameState.minerals;
    document.getElementById('gas').textContent = gameState.gas;
    document.getElementById('supply').textContent = `${gameState.supply.current}/${gameState.supply.max}`;
}

// 업그레이드 수행
function performUpgrade(up, btnElement) {
    var m = up.minerals || 0;
    var g = up.gas || 0;
    if (gameState.minerals < m || gameState.gas < g) {
        if (typeof Sound !== 'undefined') Sound.error();
        return;
    }
    if (gameState.upgrades[up.id]) {
        return;
    }
    gameState.minerals -= m;
    gameState.gas -= g;
    gameState.upgrades[up.id] = 1;
    if (typeof up.apply === 'function') {
        up.apply();
    }
    updateResources();
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.textContent = up.label + ' (완료)';
    }
    if (typeof Sound !== 'undefined') Sound.build();
}

// 건물 건설
function buildBuilding(x, y, type) {
    const buildingData = buildingTypes[type];
    if (gameState.minerals >= buildingData.cost.minerals &&
        gameState.gas >= buildingData.cost.gas) {
        gameState.minerals -= buildingData.cost.minerals;
        gameState.gas -= buildingData.cost.gas;
        gameState.buildings.push(new Building(x, y, type));
        if (buildingData.supplyProvided) {
            gameState.supply.max += buildingData.supplyProvided;
            if (gameState.supply.max > MAX_SUPPLY) gameState.supply.max = MAX_SUPPLY;
        }
        updateResources();
        if (typeof Sound !== 'undefined') Sound.build();
        return true;
    }
    if (typeof Sound !== 'undefined') Sound.error();
    return false;
}

// 해당 유닛을 훈련할 수 있는 건물 찾기
function findTrainBuilding(unitType) {
    for (var i = 0; i < gameState.buildings.length; i++) {
        var b = gameState.buildings[i];
        var data = buildingTypes[b.type];
        if (data && data.canTrain && data.canTrain.indexOf(unitType) >= 0) return b;
    }
    return null;
}

// 유닛 생성
function createUnit(type, x, y) {
    const unitData = unitTypes[type];
    var supplyOk = unitData.supplyProvided
        ? (gameState.supply.current <= gameState.supply.max)
        : (gameState.supply.current + unitData.supply <= gameState.supply.max);
    if (gameState.minerals >= unitData.cost.minerals &&
        gameState.gas >= unitData.cost.gas && supplyOk) {
        gameState.minerals -= unitData.cost.minerals;
        gameState.gas -= unitData.cost.gas;
        if (!unitData.supplyProvided) {
            gameState.supply.current += unitData.supply;
        }
        if (unitData.supplyProvided) {
            gameState.supply.max += unitData.supplyProvided;
            if (gameState.supply.max > MAX_SUPPLY) gameState.supply.max = MAX_SUPPLY;
        }
        gameState.units.push(new Unit(x, y, type, 'player'));
        updateResources();
        if (typeof Sound !== 'undefined') Sound.unitReady();
        return true;
    }
    if (typeof Sound !== 'undefined') Sound.error();
    return false;
}

// 맵 그리기
function drawMap() {
    var cam = gameState.camera;
    if (mapImage && mapImage.complete && mapImage.naturalWidth) {
        var iw = mapImage.naturalWidth;
        var ih = mapImage.naturalHeight;
        var sx = (cam.x / MAP_W) * iw;
        var sy = (cam.y / MAP_H) * ih;
        var sw = (canvas.width / MAP_W) * iw;
        var sh = (canvas.height / MAP_H) * ih;
        ctx.drawImage(mapImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        // 맵 위에 약한 그리드로 가독성 유지
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        var gridSize = 50;
        var startX = Math.floor(cam.x / gridSize) * gridSize;
        var startY = Math.floor(cam.y / gridSize) * gridSize;
        for (var x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x - cam.x, 0);
            ctx.lineTo(x - cam.x, canvas.height);
            ctx.stroke();
        }
        for (var y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y - cam.y);
            ctx.lineTo(canvas.width, y - cam.y);
            ctx.stroke();
        }
    } else {
        // 맵 이미지 없을 때 그리드 배경
        var gridSize = 50;
        ctx.fillStyle = '#2a3328';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        var startX = Math.floor(cam.x / gridSize) * gridSize;
        var startY = Math.floor(cam.y / gridSize) * gridSize;
        for (var x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x - cam.x, 0);
            ctx.lineTo(x - cam.x, canvas.height);
            ctx.stroke();
        }
        for (var y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y - cam.y);
            ctx.lineTo(canvas.width, y - cam.y);
            ctx.stroke();
        }
    }
}

// 미니맵 그리기
function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const scaleX = minimapCanvas.width / gameState.mapSize.width;
    const scaleY = minimapCanvas.height / gameState.mapSize.height;

    // 자원 그리기
    gameState.resources.forEach(resource => {
        minimapCtx.fillStyle = resource.type === 'mineral' ? '#4169e1' : '#00ced1';
        minimapCtx.fillRect(
            resource.x * scaleX - 2,
            resource.y * scaleY - 2,
            4,
            4
        );
    });

    // 플레이어 건물
    gameState.buildings.forEach(building => {
        minimapCtx.fillStyle = '#3498db';
        minimapCtx.fillRect(
            building.x * scaleX - 3,
            building.y * scaleY - 3,
            6,
            6
        );
    });

    // 적 건물
    gameState.enemyBuildings.forEach(building => {
        minimapCtx.fillStyle = '#ff0000';
        minimapCtx.fillRect(
            building.x * scaleX - 3,
            building.y * scaleY - 3,
            6,
            6
        );
    });

    // 플레이어 유닛
    gameState.units.forEach(unit => {
        minimapCtx.fillStyle = '#00ff00';
        minimapCtx.fillRect(
            unit.x * scaleX - 1,
            unit.y * scaleY - 1,
            2,
            2
        );
    });

    // 적 유닛
    gameState.enemyUnits.forEach(unit => {
        minimapCtx.fillStyle = '#ff0000';
        minimapCtx.fillRect(
            unit.x * scaleX - 1,
            unit.y * scaleY - 1,
            2,
            2
        );
    });

    // 카메라 뷰포트 표시
    const viewportX = gameState.camera.x * scaleX;
    const viewportY = gameState.camera.y * scaleY;
    const viewportW = canvas.width * scaleX;
    const viewportH = canvas.height * scaleY;

    minimapCtx.strokeStyle = '#ffff00';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(viewportX, viewportY, viewportW, viewportH);
}

// 플레이어 유닛 수 (맵 + 벙커 수용)
function getPlayerUnitCount() {
    var n = gameState.units.length;
    gameState.buildings.forEach(function(b) {
        if (b.garrison && b.garrison.length) n += b.garrison.length;
    });
    return n;
}

// 게임 렌더링
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState.enemyBuildings.length === 0 && gameState.enemyUnits.length === 0) {
        gameState.gameOver = true;
        gameState.victory = true;
    } else if (gameState.buildings.length === 0 && getPlayerUnitCount() === 0) {
        gameState.gameOver = true;
        gameState.victory = false;
    }

    if (gameState.gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = gameState.victory ? '#7cfc00' : '#e0d8c0';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gameState.victory ? '승리!' : '게임 종료', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#e0d8c0';
        ctx.font = '20px Arial';
        ctx.fillText(gameState.victory ? '적의 모든 건물과 유닛을 파괴했습니다.' : '건물과 유닛이 모두 파괴되었습니다.', canvas.width / 2, canvas.height / 2 + 20);
        requestAnimationFrame(render);
        return;
    }

    gameState.totalFrames++;
    gameState.enemyAITimer++;
    if (gameState.enemyAITimer >= 280) {
        gameState.enemyAITimer = 0;
        runEnemyAI();
    }

    clampCamera();
    drawMap();

    // 자원 그리기
    gameState.resources.forEach(resource => resource.draw());

    // 건물 그리기
    gameState.buildings.forEach(building => building.draw());
    gameState.enemyBuildings.forEach(building => building.draw());

    // 유닛 그리기
    gameState.units.forEach(unit => {
        unit.update();
        unit.draw();
    });

    // 적 유닛 업데이트 및 그리기
    gameState.enemyUnits.forEach(unit => {
        unit.update();
        unit.draw();

        // 적 AI - 플레이어 유닛 발견 시 공격, 일정 시간 후에만 기지로 선제 이동
        if (unit.data.canAttack && !unit.attacking) {
            var detectRange = unit.data.range * 35;
            var nearest = null;
            var nearestDist = 1e9;
            for (var pi = 0; pi < gameState.units.length; pi++) {
                var pu = gameState.units[pi];
                var dx = pu.x - unit.x;
                var dy = pu.y - unit.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < detectRange && dist < nearestDist) {
                    nearestDist = dist;
                    nearest = pu;
                }
            }
            if (nearest) {
                unit.attack(nearest);
            } else if (gameState.totalFrames >= gameState.enemyAttackUnlockFrame) {
                // 일정 시간(약 10초) 경과 후에만 플레이어 기지로 이동
                unit.targetX = PLAYER_BASE_X;
                unit.targetY = PLAYER_BASE_Y;
            }
        }

        // 적 공격 처리
        if (unit.data.canAttack && unit.attacking) {
            const dx = unit.attacking.x - unit.x;
            const dy = unit.attacking.y - unit.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= unit.data.range * 20) {
                unit.attacking.hp -= unit.data.attack * 0.1;
                if (unit.attacking.hp <= 0) {
                    // 플레이어 유닛 제거
                    const index = gameState.units.indexOf(unit.attacking);
                    if (index > -1) {
                        var dead = unit.attacking.data;
                        gameState.supply.current -= (dead.supply || 0);
                        if (dead.supplyProvided) gameState.supply.max -= dead.supplyProvided;
                        gameState.units.splice(index, 1);
                    }
                    unit.attacking = null;
                }
            }
        }
    });

    // 박스 선택 그리기 (맵과 어울리게)
    if (isSelecting) {
        ctx.strokeStyle = 'rgba(120, 220, 100, 0.95)';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            selectStart.x,
            selectStart.y,
            selectEnd.x - selectStart.x,
            selectEnd.y - selectStart.y
        );
        ctx.fillStyle = 'rgba(100, 200, 80, 0.12)';
        ctx.fillRect(
            selectStart.x,
            selectStart.y,
            selectEnd.x - selectStart.x,
            selectEnd.y - selectStart.y
        );
    }

    // 미니맵 그리기
    drawMinimap();

    // 건설 모드 표시
    if (gameState.buildMode) {
        const mouseX = gameState.mouseX + gameState.camera.x;
        const mouseY = gameState.mouseY + gameState.camera.y;
        const buildingData = buildingTypes[gameState.buildMode];

        ctx.fillStyle = 'rgba(100, 200, 80, 0.25)';
        ctx.fillRect(
            mouseX - gameState.camera.x - buildingData.size / 2,
            mouseY - gameState.camera.y - buildingData.size / 2,
            buildingData.size,
            buildingData.size
        );
    }

    requestAnimationFrame(render);
}

// 마우스 이벤트 (화면이동은 방향키만, 왼쪽 드래그는 그룹 선택)
let isSelecting = false;
let selectStart = { x: 0, y: 0 };
let selectEnd = { x: 0, y: 0 };
let leftMouseDown = false;
const BOX_SELECT_THRESHOLD = 5; // 이 거리 이상 드래그하면 그룹(박스) 선택

function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function handleMouseMove(e) {
    var pos = getCanvasCoords(e);
    var x = pos.x, y = pos.y;
    gameState.mouseX = x + gameState.camera.x;
    gameState.mouseY = y + gameState.camera.y;
    if (isSelecting) {
        selectEnd = { x: x, y: y };
    }
}

function handleDocMouseUp(e) {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleDocMouseUp);
    if (e.button !== 0) return;
    leftMouseDown = false;
    if (!isSelecting) return;
    var pos = getCanvasCoords(e);
    var x = pos.x, y = pos.y;
    var dist = Math.hypot(x - selectStart.x, y - selectStart.y);
    if (dist < BOX_SELECT_THRESHOLD) {
        var worldX = x + gameState.camera.x;
        var worldY = y + gameState.camera.y;
        selectUnits(worldX, worldY);
    } else {
        selectUnits(selectStart.x, selectStart.y, true, selectEnd.x, selectEnd.y);
    }
    isSelecting = false;
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 0) { // 왼쪽 클릭
        leftMouseDown = true;
        if (gameState.buildMode) {
            const worldX = x + gameState.camera.x;
            const worldY = y + gameState.camera.y;
            if (buildBuilding(worldX, worldY, gameState.buildMode)) {
                gameState.buildMode = null;
            }
        } else {
            isSelecting = true;
            selectStart = { x, y };
            selectEnd = { x, y };
        }
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleDocMouseUp);
    }
});

canvas.addEventListener('mousemove', handleMouseMove);

canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 0) return;
    if (e.button === 2) {
        const worldX = x + gameState.camera.x;
        const worldY = y + gameState.camera.y;

        // 우클릭 미네랄: SCV 채굴 명령 (가장 가까운 사령부로 반납)
        var clickedResource = null;
        for (var ri = 0; ri < gameState.resources.length; ri++) {
            var res = gameState.resources[ri];
            if ((res.type !== 'mineral' && res.type !== 'gas') || res.amount <= 0) continue;
            var rdx = res.x - worldX;
            var rdy = res.y - worldY;
            // Resource에는 sizeW/sizeH만 있으므로 이를 이용해 클릭 판정
            var rRadius = Math.max(res.sizeW || 20, res.sizeH || 20);
            if (rdx * rdx + rdy * rdy < (rRadius + 10) * (rRadius + 10)) {
                clickedResource = res;
                break;
            }
        }
        if (clickedResource) {
            var mainType = (RACE_CONFIG[gameState.playerRace] && RACE_CONFIG[gameState.playerRace].mainBuilding) || 'command-center';
            var depot = gameState.buildings.find(function(b) { return b.type === mainType; });
            if (depot) {
                gameState.selectedUnits.forEach(function(unit) {
                    if (unit.data.canMine) unit.startMining(clickedResource, depot);
                });
                if (typeof Sound !== 'undefined') Sound.move();
            }
            return;
        }

        // 우클릭 아군 벙커: 진입 가능 유닛(마린 등)이 벙커에 들어감
        var clickedBunker = gameState.buildings.find(function(b) {
            if (b.type !== 'bunker' || b.team !== 'player' || !b.garrison) return false;
            var half = b.data.size / 2;
            return worldX >= b.x - half && worldX <= b.x + half && worldY >= b.y - half && worldY <= b.y + half;
        });
        if (clickedBunker && gameState.selectedUnits.length > 0) {
            var entered = 0;
            for (var ui = gameState.selectedUnits.length - 1; ui >= 0 && clickedBunker.garrison.length < BUNKER_CAPACITY; ui--) {
                var u = gameState.selectedUnits[ui];
                if (u.data.canGarrison) {
                    var idx = gameState.units.indexOf(u);
                    if (idx > -1) {
                        gameState.units.splice(idx, 1);
                        u.x = clickedBunker.x;
                        u.y = clickedBunker.y;
                        u.insideBunker = clickedBunker;
                        clickedBunker.garrison.push(u);
                        u.selected = false;
                        gameState.selectedUnits.splice(ui, 1);
                        entered++;
                    }
                }
            }
            if (entered > 0) {
                if (typeof Sound !== 'undefined') Sound.move();
                updateInfoPanel();
                return;
            }
        }

        // 벙커 선택 상태에서 빈 땅 우클릭: 수용 유닛 내보내기
        var selBunker = gameState.buildings.find(function(b) { return b.selected && b.type === 'bunker' && b.garrison && b.garrison.length > 0; });
        if (selBunker && !targetUnit && !targetBuilding) {
            var off = 0;
            while (selBunker.garrison.length > 0) {
                var out = selBunker.garrison.pop();
                out.insideBunker = null;
                out.x = worldX + (off - 2) * 18;
                out.y = worldY;
                out.targetX = out.x;
                out.targetY = out.y;
                gameState.units.push(out);
                off++;
            }
            if (typeof Sound !== 'undefined') Sound.move();
            updateInfoPanel();
            return;
        }

        // 적 유닛 확인
        var targetUnit = gameState.enemyUnits.find(function(unit) {
            var dx = unit.x - worldX;
            var dy = unit.y - worldY;
            return Math.sqrt(dx * dx + dy * dy) < unit.data.size * 2;
        });
        var targetBuilding = null;
        if (!targetUnit) {
            targetBuilding = gameState.enemyBuildings.find(function(building) {
                var dx = building.x - worldX;
                var dy = building.y - worldY;
                var half = building.data.size / 2;
                return Math.abs(dx) < half && Math.abs(dy) < half;
            });
        }

        if (targetUnit || targetBuilding) {
            if (typeof Sound !== 'undefined') Sound.attack();
        } else if (typeof Sound !== 'undefined') Sound.move();

        gameState.selectedUnits.forEach(function(unit) {
            if (targetUnit && unit.data.canAttack) {
                unit.attackingBuilding = null;
                unit.attack(targetUnit);
            } else if (targetBuilding && unit.data.canAttack) {
                unit.attacking = null;
                unit.attackingBuilding = targetBuilding;
                unit.targetX = targetBuilding.x;
                unit.targetY = targetBuilding.y;
            } else {
                unit.moveTo(worldX, worldY);
            }
        });
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// 미니맵 클릭/드래그로 화면 이동
let minimapDragging = false;

function updateCameraFromMinimap(clientX, clientY) {
    const rect = minimapCanvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    gameState.camera.x = x * gameState.mapSize.width - canvas.width / 2;
    gameState.camera.y = y * gameState.mapSize.height - canvas.height / 2;
    clampCamera();
}

minimapCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        minimapDragging = true;
        updateCameraFromMinimap(e.clientX, e.clientY);
        if (typeof Sound !== 'undefined') Sound.minimapMove();
    }
});

minimapCanvas.addEventListener('mousemove', (e) => {
    if (minimapDragging) {
        updateCameraFromMinimap(e.clientX, e.clientY);
    }
});

minimapCanvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) minimapDragging = false;
});

minimapCanvas.addEventListener('mouseleave', () => {
    minimapDragging = false;
});

// 키보드 이벤트 (방향키로 화면 이동 포함)
const CAMERA_KEY_STEP = 28;
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        gameState.buildMode = null;
        gameState.selectedUnits.forEach(unit => unit.selected = false);
        gameState.selectedUnits = [];
        gameState.buildings.forEach(building => building.selected = false);
        updateInfoPanel();
    }
    // 방향키로 화면 이동
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) !== -1) {
        if (e.key === 'ArrowLeft')  gameState.camera.x -= CAMERA_KEY_STEP;
        if (e.key === 'ArrowRight') gameState.camera.x += CAMERA_KEY_STEP;
        if (e.key === 'ArrowUp')    gameState.camera.y -= CAMERA_KEY_STEP;
        if (e.key === 'ArrowDown')  gameState.camera.y += CAMERA_KEY_STEP;
        clampCamera();
        e.preventDefault();
    }
});

// 선택 유닛 정지/홀드 (명령 취소)
function stopSelectedUnits() {
    gameState.selectedUnits.forEach(function(unit) {
        unit.targetX = unit.x;
        unit.targetY = unit.y;
        unit.miningTarget = null;
        unit.carryingMinerals = 0;
        unit.carryingGas = 0;
        unit.depot = null;
        unit.minePhase = 'idle';
        unit.mineTimer = 0;
        if (unit.attacking) unit.attacking = null;
        if (unit.attackingBuilding) unit.attackingBuilding = null;
    });
    if (typeof Sound !== 'undefined') Sound.move();
}

// 명령 카드 액션 버튼 (공격, 정지, 홀드, 이동, 순찰, 메뉴)
function setupActionButtons() {
    var btnAttack = document.getElementById('btn-attack');
    var btnStop = document.getElementById('btn-stop');
    var btnHold = document.getElementById('btn-hold');
    var btnMove = document.getElementById('btn-move');
    var btnPatrol = document.getElementById('btn-patrol');
    var btnMenu = document.getElementById('btn-menu');
    if (btnAttack) {
        btnAttack.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            if (gameState.selectedUnits.length > 0 && typeof Sound !== 'undefined') Sound.attack();
        };
    }
    if (btnStop) {
        btnStop.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            stopSelectedUnits();
        };
    }
    if (btnHold) {
        btnHold.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            stopSelectedUnits();
        };
    }
    if (btnMove) {
        btnMove.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            // 이동: 맵 우클릭으로 지정 (기존 동작)
        };
    }
    if (btnPatrol) {
        btnPatrol.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            if (gameState.selectedUnits.length > 0) stopSelectedUnits();
        };
    }
    if (btnMenu) {
        btnMenu.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            gameState.buildMode = null;
            gameState.selectedUnits.forEach(function(u) { u.selected = false; });
            gameState.selectedUnits = [];
            gameState.buildings.forEach(function(b) { b.selected = false; });
            updateInfoPanel();
        };
    }
}
setupActionButtons();

// 빌드 버튼 클릭 핸들러 등록
function setupBuildButtons() {
    document.querySelectorAll('#build-panel .build-btn').forEach(function(btn) {
        btn.onclick = function() {
            if (typeof Sound !== 'undefined') Sound.click();
            var unitType = btn.getAttribute('data-unit');
            if (unitTypes[unitType]) {
                var trainBuilding = findTrainBuilding(unitType);
                if (trainBuilding) createUnit(unitType, trainBuilding.x + 55, trainBuilding.y);
                else if (typeof Sound !== 'undefined') Sound.error();
            } else if (buildingTypes[unitType]) {
                gameState.buildMode = unitType;
            }
        };
    });
}

// 종족 선택 후 게임 시작
function startGame(race) {
    gameState.playerRace = race;
    gameState.gameOver = false;
    gameState.victory = false;
    gameState.buildings = [];
    gameState.units = [];
    gameState.selectedUnits = [];
    gameState.enemyUnits = [];
    gameState.enemyBuildings = [];
    gameState.minerals = 100;
    gameState.gas = 100;
    gameState.supply = { current: 5, max: 8 };
    gameState.enemySupply = { current: 3, max: 8 };
    gameState.enemyMinerals = 200;
    gameState.enemyGas = 50;
    gameState.enemyAITimer = 0;
    gameState.upgrades = {};
    gameState.totalFrames = 0;
    resizeCanvas();
    var panel = document.getElementById('build-panel');
    if (panel) {
        // 초기에는 아무것도 선택되지 않았으므로 빌드 패널 비워둠
        panel.innerHTML = '';
    }
    initResources();
    initBuildings();
    initUnits();
    updateResources();
    gameState.camera.x = PLAYER_BASE_X - canvas.width / 2;
    gameState.camera.y = PLAYER_BASE_Y - canvas.height / 2;
    clampCamera();
    var menu = document.getElementById('play-menu');
    if (menu) menu.classList.add('hidden');
    render();
}
window.startGame = startGame;
