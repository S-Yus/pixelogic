const SIZE = 15;
const MAX_MISTAKES = 5;

let solution = [];
let userState = []; // 0:Empty, 1:Filled, 2:Cross
let mistakeCount = 0;
let isGameOver = false;

let isMouseDown = false;
let currentMode = 1; // 1: Fill, 2: Cross

document.addEventListener('DOMContentLoaded', () => {
    const newGameBtn = document.getElementById('new-game-btn');
    if(newGameBtn) newGameBtn.addEventListener('click', startNewGame);
    
    const modeToggle = document.getElementById('mode-toggle');
    if(modeToggle) {
        modeToggle.addEventListener('change', (e) => {
            currentMode = e.target.checked ? 1 : 2; 
        });
    }

    startNewGame();
});

function startNewGame() {
    isGameOver = false;
    mistakeCount = 0;
    updateMistakeDisplay();
    
    const msg = document.getElementById('status-message');
    if(msg) msg.textContent = "";

    generateRandomSolution();
    resetUserState();
    drawBoard();
}

function updateMistakeDisplay() {
    const el = document.getElementById('mistake-count');
    if(el) {
        el.textContent = mistakeCount;
        el.style.color = mistakeCount >= MAX_MISTAKES ? 'red' : '';
    }
}

// 簡易的なランダム生成（ソルバーなしで高速化）
function generateRandomSolution() {
    solution = [];
    for (let r = 0; r < SIZE; r++) {
        let row = [];
        for (let c = 0; c < SIZE; c++) {
            row.push(Math.random() < 0.55 ? 1 : 0);
        }
        solution.push(row);
    }
}

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
    
    window.addEventListener('mouseup', () => isMouseDown = false);
}

function startDrag(r, c) {
    if (isGameOver) return;
    isMouseDown = true;
    applyAction(r, c);
}

function continueDrag(r, c) {
    if (isGameOver || !isMouseDown) return;
    applyAction(r, c);
}

// アクション実行（ここで正誤判定を行う）
function applyAction(r, c) {
    // 既に何らかの状態が入っているマスは操作できない（上書き禁止）
    if (userState[r][c] !== 0) return;

    const correctValue = solution[r][c];
    
    // --- 判定ロジック ---
    if (currentMode === 1) { // プレイヤーは「塗る」つもり
        if (correctValue === 1) {
            // 正解（塗るべき場所だった）
            userState[r][c] = 1;
        } else {
            // 不正解（塗ってはいけない場所だった）
            // ペナルティ：本来は空(×)であることを強制開示し、赤くする
            userState[r][c] = 2; // バツとして記録
            registerMistake(r, c, 'cross'); // 'cross'エラーを表示（赤いバツ）
        }
    } else { // プレイヤーは「×」のつもり
        if (correctValue === 0) {
            // 正解（×で合っている）
            userState[r][c] = 2;
        } else {
            // 不正解（本来は塗るべき場所だった）
            // ペナルティ：本来は塗りであることを強制開示し、赤くする
            userState[r][c] = 1; // 塗りとして記録
            registerMistake(r, c, 'fill'); // 'fill'エラーを表示（赤い塗り）
        }
    }

    updateCellVisual(r, c);
    
    // オートコンプリートと勝利判定は、正しい操作だった場合のみ行うのが一般的だが、
    // ミス修正後も状況が進むので毎回チェックしても良い
    checkAutoCross(r, c);
    checkWin();
}

function registerMistake(r, c, type) {
    mistakeCount++;
    updateMistakeDisplay();

    // 該当セルにエラー用のクラスを付与
    // ビジュアル更新関数内でクラス付け替えを行うためのフラグをセットしてもいいが
    // ここではDOMを直接操作してエラー状態を記憶させる
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    if (type === 'cross') {
        // 本来×なのに塗ろうとした -> 赤い×
        cell.classList.add('error-cross');
    } else {
        // 本来塗りなのに×しようとした -> 赤い塗り
        cell.classList.add('error-fill');
    }

    if (mistakeCount >= MAX_MISTAKES) {
        triggerGameOver();
    }
}

function triggerGameOver() {
    isGameOver = true;
    const msg = document.getElementById('status-message');
    if(msg) {
        msg.textContent = "GAME OVER";
        msg.style.color = "red";
    }
    alert("Game Over! Too many mistakes.");
}


function updateCellVisual(r, c) {
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    
    // エラー表示クラスは消さないように注意する（addしたままにする）
    // 基本的な filled / crossed のみを制御
    if (userState[r][c] === 1) cell.classList.add('filled');
    if (userState[r][c] === 2) cell.classList.add('crossed');
}


function checkAutoCross(changedR, changedC) {
    // 行
    if (shouldAutoCrossLine(solution[changedR], userState[changedR])) {
        for (let c = 0; c < SIZE; c++) {
            if (userState[changedR][c] === 0) {
                userState[changedR][c] = 2; 
                updateCellVisual(changedR, c);
            }
        }
    }
    // 列
    let colSol = [], colUser = [];
    for(let r=0; r<SIZE; r++) {
        colSol.push(solution[r][changedC]);
        colUser.push(userState[r][changedC]);
    }
    if (shouldAutoCrossLine(colSol, colUser)) {
        for (let r = 0; r < SIZE; r++) {
            if (userState[r][changedC] === 0) {
                userState[r][changedC] = 2;
                updateCellVisual(r, changedC);
            }
        }
    }
}

function shouldAutoCrossLine(solLine, userLine) {
    const targetCount = solLine.filter(x => x === 1).length;
    // ユーザーが正しく塗った数だけをカウント（エラーで強制開示された塗りも含む）
    const currentCount = userLine.filter(x => x === 1).length;
    return targetCount === currentCount;
}

function checkWin() {
    if (isGameOver) return;

    let correct = true;
    for(let r=0; r<SIZE; r++) {
        for(let c=0; c<SIZE; c++) {
            // 正解が1なのに塗ってない、または正解が0なのに塗ってる
            // userStateにはミスで修正された結果も入るので、
            // 全て埋まっていれば自然と勝利になる
            if (solution[r][c] === 1 && userState[r][c] !== 1) correct = false;
            if (solution[r][c] === 0 && userState[r][c] === 1) correct = false;
        }
    }
    
    if (correct) {
        isGameOver = true;
        const msg = document.getElementById('status-message');
        if(msg) {
            msg.textContent = "CLEARED! CONGRATULATIONS!";
            msg.style.color = "#2c3e50";
        }
    }
}