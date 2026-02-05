const SIZE = 15;
const MAX_MISTAKES = 5;

// ゲーム状態
let solution = [];
let userState = []; // 0:Empty, 1:Filled, 2:Cross
let mistakeCount = 0;
let isGameOver = false;

// タイマー
let timerInterval = null;
let secondsElapsed = 0;

// 操作関連
let isMouseDown = false;
let currentMode = 1; // 1: Fill, 2: Cross
let currentDragTarget = null; // ドラッグ開始時のターゲット（上書き防止用）

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    // ボタン設定
    const newBtn = document.getElementById('new-game-btn');
    if(newBtn) newBtn.addEventListener('click', startNewGame);
    
    // スイッチ設定
    const modeToggle = document.getElementById('mode-toggle');
    if(modeToggle) {
        // 初期状態取得
        currentMode = modeToggle.checked ? 1 : 2; 
        modeToggle.addEventListener('change', (e) => {
            currentMode = e.target.checked ? 1 : 2; 
        });
    }

    // 初回ゲーム開始
    startNewGame();
});


// --- ゲーム進行管理 ---

function startNewGame() {
    isGameOver = false;
    mistakeCount = 0;
    
    // タイマーリセット
    stopTimer();
    secondsElapsed = 0;
    updateTimerDisplay();
    startTimer();
    
    updateMistakeDisplay();
    
    const msg = document.getElementById('status-message');
    if(msg) {
        msg.textContent = "";
        msg.style.color = "";
    }

    // 盤面生成
    generateBlockySolution();
    
    resetUserState();
    drawBoard();
}

function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if(timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const el = document.getElementById('timer');
    if(!el) return;
    const min = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const sec = (secondsElapsed % 60).toString().padStart(2, '0');
    el.textContent = `${min}:${sec}`;
}

function updateMistakeDisplay() {
    const el = document.getElementById('mistake-count');
    if(el) {
        el.textContent = mistakeCount;
        el.style.color = mistakeCount >= MAX_MISTAKES ? 'var(--error-color)' : '';
    }
}


// --- 盤面生成ロジック (ヒント数抑制版) ---

function generateBlockySolution() {
    // 1. 白紙作成
    solution = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    // 2. 矩形をランダム配置 (4~7個)
    const numRects = 4 + Math.floor(Math.random() * 4); 
    for (let i = 0; i < numRects; i++) {
        // サイズをある程度大きく保つ
        const w = 3 + Math.floor(Math.random() * 6); // 幅3-8
        const h = 3 + Math.floor(Math.random() * 6); // 高さ3-8
        const x = Math.floor(Math.random() * (SIZE - w));
        const y = Math.floor(Math.random() * (SIZE - h));
        
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                solution[y + dy][x + dx] = 1;
            }
        }
    }

    // 3. ヒントが「2つ以下」になるように隙間を埋める (行・列それぞれ数回実行)
    for (let iter = 0; iter < 4; iter++) {
        for (let r = 0; r < SIZE; r++) {
            mergeBlocks(solution[r]);
        }
        for (let c = 0; c < SIZE; c++) {
            let col = [];
            for (let r = 0; r < SIZE; r++) col.push(solution[r][c]);
            mergeBlocks(col);
            for (let r = 0; r < SIZE; r++) solution[r][c] = col[r];
        }
    }
}

// 1行(列)の中で、ブロック数が2つを超えていたら結合して減らす
function mergeBlocks(line) {
    let blocks = [];
    let inBlock = false;
    let start = -1;

    // 現在のブロックを検出
    for (let i = 0; i < SIZE; i++) {
        if (line[i] === 1) {
            if (!inBlock) { inBlock = true; start = i; }
        } else {
            if (inBlock) { inBlock = false; blocks.push({s: start, e: i-1}); }
        }
    }
    if (inBlock) blocks.push({s: start, e: SIZE-1});

    // 3つ以上の塊がある場合、距離が近いものを結合
    while (blocks.length > 2) {
        let minGap = SIZE;
        let mergeIdx = 0;
        
        for (let i = 0; i < blocks.length - 1; i++) {
            const gap = blocks[i+1].s - blocks[i].e;
            if (gap < minGap) {
                minGap = gap;
                mergeIdx = i;
            }
        }
        
        // 間の0を1に変える
        const b1 = blocks[mergeIdx];
        const b2 = blocks[mergeIdx+1];
        for (let k = b1.e + 1; k < b2.s; k++) {
            line[k] = 1;
        }
        
        // リスト更新（簡易的に結合後の情報へ）
        blocks[mergeIdx].e = b2.e;
        blocks.splice(mergeIdx + 1, 1);
    }
}


// --- 描画・操作系 ---

function getHints(line) {
    const hints = [];
    let count = 0;
    for (let cell of line) {
        if (cell === 1) count++;
        else {
            if (count > 0) hints.push(count);
            count = 0;
        }
    }
    if (count > 0) hints.push(count);
    return hints.length ? hints : [0];
}

function resetUserState() {
    userState = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function drawBoard() {
    const topHintsDiv = document.getElementById('hints-top');
    const leftHintsDiv = document.getElementById('hints-left');
    const boardDiv = document.getElementById('board');

    if (!topHintsDiv || !leftHintsDiv || !boardDiv) return;

    topHintsDiv.innerHTML = '';
    leftHintsDiv.innerHTML = '';
    boardDiv.innerHTML = '';

    // 上ヒント
    for (let c = 0; c < SIZE; c++) {
        let col = [];
        for (let r = 0; r < SIZE; r++) col.push(solution[r][c]);
        const hints = getHints(col);
        const div = document.createElement('div');
        div.className = 'hint-col';
        hints.forEach(h => {
            const span = document.createElement('span');
            span.textContent = h;
            div.appendChild(span);
        });
        topHintsDiv.appendChild(div);
    }

    // 左ヒント
    for (let r = 0; r < SIZE; r++) {
        const hints = getHints(solution[r]);
        const div = document.createElement('div');
        div.className = 'hint-row';
        hints.forEach(h => {
            const span = document.createElement('span');
            span.textContent = h;
            div.appendChild(span);
        });
        leftHintsDiv.appendChild(div);
    }

    // 盤面セル
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            // 5マス太線用の属性
            cell.dataset.col = c;
            cell.dataset.row = r;

            // マウスイベント
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startDrag(r, c);
            });
            cell.addEventListener('mouseenter', () => continueDrag(r, c));
            
            boardDiv.appendChild(cell);
        }
    }
    
    // ドラッグ終了検知
    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        currentDragTarget = null;
    });
}


// --- 操作ロジック ---

function startDrag(r, c) {
    if (isGameOver) return;
    isMouseDown = true;
    
    // ドラッグ開始時に「未入力(0)のセル」に対して操作を行う意図を持つ
    // すでに判定済みのセルから開始した場合は何もしない
    if (userState[r][c] !== 0) {
        currentDragTarget = null;
        return;
    }
    currentDragTarget = 0; // ターゲットは未入力セル
    
    applyAction(r, c);
}

function continueDrag(r, c) {
    if (isGameOver || !isMouseDown) return;
    
    // ドラッグ中は「未入力セル」だけを塗り変える
    if (userState[r][c] === 0) {
        applyAction(r, c);
    }
}

function applyAction(r, c) {
    const correctValue = solution[r][c];
    let isMistake = false;

    // ユーザーの意図 (Fill or Cross)
    if (currentMode === 1) { // 塗る
        if (correctValue === 1) {
            userState[r][c] = 1; // 正解
        } else {
            isMistake = true;
            userState[r][c] = 2; // 本来は白(×)であることを強制開示
            registerMistake(r, c, 'cross'); // 「本来は×だよ」という赤いバツを表示
        }
    } else { // バツ
        if (correctValue === 0) {
            userState[r][c] = 2; // 正解
        } else {
            isMistake = true;
            userState[r][c] = 1; // 本来は黒(Fill)であることを強制開示
            registerMistake(r, c, 'fill'); // 「本来は塗りだよ」という赤い塗りを表示
        }
    }

    updateCellVisual(r, c);
    
    // ミスでなければオートコンプリートチェックなど
    if (!isMistake) {
        checkAutoCross(r, c);
    }
    checkWin();
}

function registerMistake(r, c, type) {
    mistakeCount++;
    updateMistakeDisplay();

    // エラー表示用のクラスを付与
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    if (type === 'cross') {
        cell.classList.add('error-cross');
    } else {
        cell.classList.add('error-fill');
    }

    if (mistakeCount >= MAX_MISTAKES) {
        triggerGameOver();
    }
}

function updateCellVisual(r, c) {
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    // エラー表示クラスは残しつつ、基本状態を反映
    if (userState[r][c] === 1) cell.classList.add('filled');
    if (userState[r][c] === 2) cell.classList.add('crossed');
}

function triggerGameOver() {
    isGameOver = true;
    stopTimer();
    const msg = document.getElementById('status-message');
    if(msg) {
        msg.textContent = "GAME OVER";
        msg.style.color = "var(--error-color)";
    }
    setTimeout(() => alert("Game Over!"), 50);
}


// --- 自動処理 & 勝利判定 ---

function checkAutoCross(changedR, changedC) {
    if (isGameOver) return;

    // 行チェック
    if (shouldAutoCrossLine(solution[changedR], userState[changedR])) {
        fillRestWithCross(changedR, null);
    }
    // 列チェック
    let colSol = [], colUser = [];
    for(let r=0; r<SIZE; r++) {
        colSol.push(solution[r][changedC]);
        colUser.push(userState[r][changedC]);
    }
    if (shouldAutoCrossLine(colSol, colUser)) {
        fillRestWithCross(null, changedC);
    }
}

function shouldAutoCrossLine(solLine, userLine) {
    const targetCount = solLine.filter(x => x === 1).length;
    const currentCount = userLine.filter(x => x === 1).length;
    // 黒の数が一致していれば（位置が合っているかは別として）完了とみなす
    // ※ミス時に強制修正されているので、数は必ず合う方向に向かう
    return targetCount === currentCount && targetCount > 0;
}

function fillRestWithCross(targetR, targetC) {
    // 行
    if (targetR !== null) {
        for (let c = 0; c < SIZE; c++) {
            if (userState[targetR][c] === 0) {
                userState[targetR][c] = 2;
                updateCellVisual(targetR, c);
            }
        }
    }
    // 列
    if (targetC !== null) {
        for (let r = 0; r < SIZE; r++) {
            if (userState[r][targetC] === 0) {
                userState[r][targetC] = 2;
                updateCellVisual(r, targetC);
            }
        }
    }
}

function checkWin() {
    if (isGameOver) return;

    let correct = true;
    for(let r=0; r<SIZE; r++) {
        for(let c=0; c<SIZE; c++) {
            // 正解が1の場所が、ユーザー状態でも1になっているか
            if (solution[r][c] === 1 && userState[r][c] !== 1) correct = false;
            // 正解が0の場所が、ユーザー状態で1になっていないか
            if (solution[r][c] === 0 && userState[r][c] === 1) correct = false;
        }
    }
    
    if (correct) {
        isGameOver = true;
        stopTimer();
        const msg = document.getElementById('status-message');
        if(msg) {
            msg.textContent = "CLEARED!";
            msg.style.color = "var(--filled-color)";
        }
    }
}