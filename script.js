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
let currentDragTarget = null; // ドラッグ開始時のターゲット

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    // ボタン設定
    const newBtn = document.getElementById('new-game-btn');
    if(newBtn) newBtn.addEventListener('click', startNewGame);
    
    // スイッチ設定
    const modeToggle = document.getElementById('mode-toggle');
    if(modeToggle) {
        currentMode = modeToggle.checked ? 1 : 2; 
        modeToggle.addEventListener('change', (e) => {
            currentMode = e.target.checked ? 1 : 2; 
        });
    }

    startNewGame();
});

// --- ゲーム進行管理 ---
function startNewGame() {
    isGameOver = false;
    mistakeCount = 0;
    
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

    // 盤面生成 (強力な制約付き)
    generateStrictSolution();
    
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


// --- 盤面生成ロジック (厳格版) ---
// ヒント数が「必ず2つ以下」になるまで結合を繰り返す
function generateStrictSolution() {
    let isValid = false;
    let attempts = 0;

    // まともな盤面ができるまで最大10回リトライ（真っ黒になりすぎた場合など）
    while (!isValid && attempts < 10) {
        attempts++;
        
        // 1. 初期化
        solution = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

        // 2. ランダムな矩形配置 (少なめ・大きめにしてノイズを減らす)
        const numRects = 3 + Math.floor(Math.random() * 3); 
        for (let i = 0; i < numRects; i++) {
            const w = 4 + Math.floor(Math.random() * 6); // 幅4-9
            const h = 4 + Math.floor(Math.random() * 6); // 高さ4-9
            const x = Math.floor(Math.random() * (SIZE - w));
            const y = Math.floor(Math.random() * (SIZE - h));
            
            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    solution[y + dy][x + dx] = 1;
                }
            }
        }

        // 3. 制約の強制適用 (ヒント > 2 なら結合)
        // 収束するまで繰り返す
        let constraintsSatisfied = false;
        let loopCount = 0;
        
        while (!constraintsSatisfied && loopCount < 20) {
            constraintsSatisfied = true;
            loopCount++;

            // 行のチェック
            for (let r = 0; r < SIZE; r++) {
                if (mergeBlocksStrict(solution[r])) {
                    constraintsSatisfied = false; // 変更があったらもう一周
                }
            }
            
            // 列のチェック
            for (let c = 0; c < SIZE; c++) {
                let col = [];
                for (let r = 0; r < SIZE; r++) col.push(solution[r][c]);
                
                if (mergeBlocksStrict(col)) {
                    constraintsSatisfied = false;
                    // 列の変更を盤面に反映
                    for (let r = 0; r < SIZE; r++) solution[r][c] = col[r];
                }
            }
        }

        // 4. バランスチェック
        // 全マス黒(225個)や、ほぼ白(10個以下)ならやり直し
        let totalFilled = 0;
        for(let r=0; r<SIZE; r++) for(let c=0; c<SIZE; c++) if(solution[r][c]) totalFilled++;
        
        if (totalFilled > 20 && totalFilled < 180) {
            isValid = true;
        }
    }
}

// 1行(列)をチェックし、ブロックが3つ以上あれば結合して変更する
// 戻り値: 変更があったら true
function mergeBlocksStrict(line) {
    let changed = false;

    // ブロック情報を取得
    // blocks = [ {s:開始index, e:終了index}, ... ]
    let getBlocks = () => {
        let b = [];
        let inBlock = false;
        let start = -1;
        for (let i = 0; i < SIZE; i++) {
            if (line[i] === 1) {
                if (!inBlock) { inBlock = true; start = i; }
            } else {
                if (inBlock) { inBlock = false; b.push({s: start, e: i-1}); }
            }
        }
        if (inBlock) b.push({s: start, e: SIZE-1});
        return b;
    };

    let blocks = getBlocks();

    // 3つ以上ある場合、2つ以下になるまで結合を繰り返す
    while (blocks.length > 2) {
        changed = true;

        // 一番隙間が狭いところを探す
        let minGap = SIZE;
        let mergeIdx = 0; // 結合する左側のブロックのインデックス
        
        for (let i = 0; i < blocks.length - 1; i++) {
            const gap = blocks[i+1].s - blocks[i].e;
            if (gap < minGap) {
                minGap = gap;
                mergeIdx = i;
            }
        }
        
        // 隙間を埋める (0 -> 1)
        const b1 = blocks[mergeIdx];
        const b2 = blocks[mergeIdx+1];
        // b1の終わりから b2の始まりまでを塗る
        for (let k = b1.e + 1; k < b2.s; k++) {
            line[k] = 1;
        }

        // ブロック情報再計算
        blocks = getBlocks();
    }
    
    return changed;
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

    // 盤面
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.dataset.col = c;
            cell.dataset.row = r;

            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startDrag(r, c);
            });
            cell.addEventListener('mouseenter', () => continueDrag(r, c));
            
            boardDiv.appendChild(cell);
        }
    }
    
    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        currentDragTarget = null;
    });
}

// --- 操作ロジック ---
function startDrag(r, c) {
    if (isGameOver) return;
    isMouseDown = true;
    
    // 操作ターゲット決定 (未入力セルのみ)
    if (userState[r][c] !== 0) {
        currentDragTarget = null;
        return;
    }
    currentDragTarget = 0;
    
    applyAction(r, c);
}

function continueDrag(r, c) {
    if (isGameOver || !isMouseDown) return;
    if (userState[r][c] === 0) {
        applyAction(r, c);
    }
}

function applyAction(r, c) {
    const correctValue = solution[r][c];
    let isMistake = false;

    if (currentMode === 1) { // 塗る
        if (correctValue === 1) {
            userState[r][c] = 1; 
        } else {
            isMistake = true;
            userState[r][c] = 2; // 強制バツ
            registerMistake(r, c, 'cross');
        }
    } else { // バツ
        if (correctValue === 0) {
            userState[r][c] = 2; 
        } else {
            isMistake = true;
            userState[r][c] = 1; // 強制塗り
            registerMistake(r, c, 'fill');
        }
    }

    updateCellVisual(r, c);
    
    if (!isMistake) {
        checkAutoCross(r, c);
    }
    checkWin();
}

function registerMistake(r, c, type) {
    mistakeCount++;
    updateMistakeDisplay();

    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    if (type === 'cross') cell.classList.add('error-cross');
    else cell.classList.add('error-fill');

    if (mistakeCount >= MAX_MISTAKES) {
        triggerGameOver();
    }
}

function updateCellVisual(r, c) {
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
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

    // 行
    if (shouldAutoCrossLine(solution[changedR], userState[changedR])) {
        fillRestWithCross(changedR, null);
    }
    // 列
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
    // 黒の数が一致したらOK（ミス修正済み前提）
    return targetCount === currentCount && targetCount > 0;
}

function fillRestWithCross(targetR, targetC) {
    if (targetR !== null) {
        for (let c = 0; c < SIZE; c++) {
            if (userState[targetR][c] === 0) {
                userState[targetR][c] = 2;
                updateCellVisual(targetR, c);
            }
        }
    }
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
            if (solution[r][c] === 1 && userState[r][c] !== 1) correct = false;
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