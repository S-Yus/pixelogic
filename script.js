const SIZE = 15;
const MAX_MISTAKES = 5;

let solution = [];
let userState = []; // 0:Empty, 1:Filled, 2:Cross
let mistakeCount = 0;
let isGameOver = false;

// タイマー用
let timerInterval = null;
let secondsElapsed = 0;

// 操作状態
let isMouseDown = false;
let currentMode = 1; // 1: Fill, 2: Cross
let draggingState = null; // ドラッグ開始時に「塗る」か「消す」か判定用

document.addEventListener('DOMContentLoaded', () => {
    // New Gameボタン
    const newBtn = document.getElementById('new-game-btn');
    if(newBtn) newBtn.addEventListener('click', startNewGame);
    
    // モード切替スイッチ
    const modeToggle = document.getElementById('mode-toggle');
    if(modeToggle) {
        currentMode = modeToggle.checked ? 1 : 2; 
        modeToggle.addEventListener('change', (e) => {
            currentMode = e.target.checked ? 1 : 2; 
        });
    }

    startNewGame();
});

// --- ゲーム進行 ---

function startNewGame() {
    isGameOver = false;
    mistakeCount = 0;
    stopTimer();
    secondsElapsed = 0;
    updateTimerDisplay();
    startTimer();
    updateMistakeDisplay();
    
    const msg = document.getElementById('status-message');
    if(msg) msg.textContent = "";

    // 盤面生成（お題を2つ以内に制限）
    generateSimpleSolution();
    
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
        el.style.color = mistakeCount >= MAX_MISTAKES ? 'red' : '';
    }
}

// --- 盤面生成ロジック (改良版) ---
// 「ヒントが最大2つ」になるように、矩形を配置して整形する
function generateSimpleSolution() {
    // 1. 全て白で初期化
    solution = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    // 2. 大きな矩形をランダムにいくつか配置（スタンプ方式）
    // これにより自然と「塊」ができる
    const numRects = 4 + Math.floor(Math.random() * 3); // 4〜6個の矩形
    for (let i = 0; i < numRects; i++) {
        const w = 3 + Math.floor(Math.random() * 6); // 幅 3-8
        const h = 3 + Math.floor(Math.random() * 6); // 高さ 3-8
        const x = Math.floor(Math.random() * (SIZE - w));
        const y = Math.floor(Math.random() * (SIZE - h));
        
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                solution[y + dy][x + dx] = 1;
            }
        }
    }

    // 3. 行と列を走査し、「ヒントが3つ以上」になってしまった箇所を修正（結合）する
    // これを数回繰り返して形を整える
    for (let iter = 0; iter < 5; iter++) {
        // 行の修正
        for (let r = 0; r < SIZE; r++) {
            ensureMaxTwoBlocks(solution[r]);
        }
        // 列の修正（転置して処理）
        for (let c = 0; c < SIZE; c++) {
            let col = [];
            for (let r = 0; r < SIZE; r++) col.push(solution[r][c]);
            ensureMaxTwoBlocks(col);
            for (let r = 0; r < SIZE; r++) solution[r][c] = col[r];
        }
    }
}

// 配列の中の「1の塊」が2つ以下になるように、隙間を埋める関数
function ensureMaxTwoBlocks(line) {
    // 現在のブロック情報を取得 [start, length] の配列
    let blocks = [];
    let inBlock = false;
    let start = 0;
    for (let i = 0; i < SIZE; i++) {
        if (line[i] === 1) {
            if (!inBlock) { inBlock = true; start = i; }
        } else {
            if (inBlock) { inBlock = false; blocks.push({s: start, e: i-1}); }
        }
    }
    if (inBlock) blocks.push({s: start, e: SIZE-1});

    // ブロックが3つ以上ある場合、結合して減らす
    while (blocks.length > 2) {
        // 距離が最も近いブロック同士を探す
        let minGap = SIZE;
        let mergeIdx = 0; // index of first block to merge
        
        for (let i = 0; i < blocks.length - 1; i++) {
            const gap = blocks[i+1].s - blocks[i].e;
            if (gap < minGap) {
                minGap = gap;
                mergeIdx = i;
            }
        }
        
        // 結合実行（間の0を1にする）
        const b1 = blocks[mergeIdx];
        const b2 = blocks[mergeIdx+1];
        for (let k = b1.e + 1; k < b2.s; k++) {
            line[k] = 1;
        }
        
        // blocks配列を再計算（面倒なので再帰的に解決させるためループ継続）
        // 簡易的にリスト更新
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

    // 盤面
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
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
    
    // 画面外で離した時の対策
    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        draggingState = null;
    });
}

// --- 操作ロジック ---

function startDrag(r, c) {
    if (isGameOver) return;
    isMouseDown = true;
    
    // 操作の「意図」を決定する
    // 空マスをクリック -> そのモードで塗る
    // 既に自分のモードで塗られている -> 何もしない（あるいは消す実装もありだが今回はシンプルに）
    draggingState = currentMode;
    
    applyAction(r, c);
}

function continueDrag(r, c) {
    if (isGameOver || !isMouseDown) return;
    applyAction(r, c);
}

function applyAction(r, c) {
    // 既に何らかの状態が確定している（正解 or ミス修正済み）なら何もしない
    // ただし、ドラッグ操作中に「まだ操作していないマス」だけを変えたい
    if (userState[r][c] !== 0) return;

    const correctValue = solution[r][c];
    
    // 判定ロジック
    // 「塗るモード(1)」で操作
    if (currentMode === 1) {
        if (correctValue === 1) {
            // 正解: 塗る
            userState[r][c] = 1;
        } else {
            // ミス: 本来は白(0)なので、バツ(2)を強制表示してペナルティ
            userState[r][c] = 2;
            registerMistake(r, c, 'cross');
        }
    } 
    // 「バツモード(2)」で操作
    else {
        if (correctValue === 0) {
            // 正解: バツを置く
            userState[r][c] = 2;
        } else {
            // ミス: 本来は黒(1)なので、塗り(1)を強制表示してペナルティ
            userState[r][c] = 1;
            registerMistake(r, c, 'fill');
        }
    }

    updateCellVisual(r, c);
    checkAutoCross(r, c);
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

function triggerGameOver() {
    isGameOver = true;
    stopTimer();
    const msg = document.getElementById('status-message');
    if(msg) {
        msg.textContent = "GAME OVER";
        msg.style.color = "red";
    }
    // 少し遅らせてアラート（描画反映後）
    setTimeout(() => alert("Game Over!"), 10);
}

function updateCellVisual(r, c) {
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    if (userState[r][c] === 1) cell.classList.add('filled');
    if (userState[r][c] === 2) cell.classList.add('crossed');
}

// 自動バツ埋め機能
function checkAutoCross(changedR, changedC) {
    if (isGameOver) return;

    // 行チェック
    // ユーザーの状態（ミスによる強制訂正含む）と正解の「黒の数」が一致したら、残りをバツに
    if (shouldAutoCrossLine(solution[changedR], userState[changedR])) {
        fillRestWithCross(changedR, null); // 行全体
    }

    // 列チェック
    let colSol = [], colUser = [];
    for(let r=0; r<SIZE; r++) {
        colSol.push(solution[r][changedC]);
        colUser.push(userState[r][changedC]);
    }
    if (shouldAutoCrossLine(colSol, colUser)) {
        fillRestWithCross(null, changedC); // 列全体
    }
}

function shouldAutoCrossLine(solLine, userLine) {
    const targetCount = solLine.filter(x => x === 1).length;
    const currentCount = userLine.filter(x => x === 1).length;
    return targetCount === currentCount;
}

function fillRestWithCross(targetR, targetC) {
    // 行の場合
    if (targetR !== null) {
        for (let c = 0; c < SIZE; c++) {
            if (userState[targetR][c] === 0) {
                userState[targetR][c] = 2; // バツ
                updateCellVisual(targetR, c);
            }
        }
    }
    // 列の場合
    if (targetC !== null) {
        for (let r = 0; r < SIZE; r++) {
            if (userState[r][targetC] === 0) {
                userState[r][targetC] = 2; // バツ
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
            // 未入力(0)がある、または不一致があればクリアではない
            // ただし、userStateはミス時に強制修正されるので、
            // 「すべてのマスが0ではなくなっている」かつ「黒マスの位置が正しい」ならクリア
            // ここではシンプルに「黒マスの位置がすべてuserStateで1になっているか」を見る
            if (solution[r][c] === 1 && userState[r][c] !== 1) correct = false;
            // 白マスの位置が1になっていないか（これはapplyActionで防がれるが念のため）
            if (solution[r][c] === 0 && userState[r][c] === 1) correct = false;
        }
    }
    
    if (correct) {
        isGameOver = true;
        stopTimer();
        const msg = document.getElementById('status-message');
        if(msg) {
            msg.textContent = "CLEARED!";
            msg.style.color = "#4CAF50";
        }
    }
}