const SIZE = 15;
let solution = [];
let userState = []; // 0:Empty, 1:Filled, 2:Cross
let isMouseDown = false;
let currentMode = 1; // 1: Fill, 2: Cross (Toggle switch controls this)

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('new-game-btn').addEventListener('click', startNewGame);
    
    // スイッチの切り替え監視
    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.addEventListener('change', (e) => {
        currentMode = e.target.checked ? 1 : 2; // ON=Fill(1), OFF=Cross(2)
    });

    startNewGame();
});

// --- ゲーム開始 ---
function startNewGame() {
    document.getElementById('status-message').textContent = "Generating solvable puzzle...";
    
    // 非同期で少し待ってから生成（UIのレンダリングをブロックしないため）
    setTimeout(() => {
        // 解ける問題が出るまでループ
        let solvable = false;
        let attempts = 0;
        
        while (!solvable && attempts < 100) {
            generateRandomSolution();
            if (checkIsSolvable()) {
                solvable = true;
            }
            attempts++;
        }
        
        if (!solvable) {
            console.warn("Could not generate a purely logic-solvable board in 100 attempts. Using last one.");
        }

        resetUserState();
        drawBoard();
        document.getElementById('status-message').textContent = "";
    }, 10);
}

// --- ランダムな盤面生成 ---
function generateRandomSolution() {
    solution = [];
    for (let r = 0; r < SIZE; r++) {
        let row = [];
        for (let c = 0; c < SIZE; c++) {
            // 塗り密度 55% くらいがパズルとして成立しやすい
            row.push(Math.random() < 0.55 ? 1 : 0);
        }
        solution.push(row);
    }
}

// --- ソルバー (簡易版: ラインロジック判定) ---
// 人間が「仮置き」なしで解けるかを判定する
function checkIsSolvable() {
    // 現在の盤面知識（0:不明, 1:黒, 2:白）
    let solverBoard = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    let changed = true;

    const rowHints = solution.map(row => getHints(row));
    const colHints = [];
    for (let c = 0; c < SIZE; c++) {
        let col = [];
        for (let r = 0; r < SIZE; r++) col.push(solution[r][c]);
        colHints.push(getHints(col));
    }

    while (changed) {
        changed = false;
        
        // 行ごとのチェック
        for (let r = 0; r < SIZE; r++) {
            const result = solveLine(solverBoard[r], rowHints[r]);
            if (result) { // 何か確定したら更新
                for (let c = 0; c < SIZE; c++) {
                    if (solverBoard[r][c] === 0 && result[c] !== 0) {
                        solverBoard[r][c] = result[c];
                        changed = true;
                    }
                }
            }
        }
        
        // 列ごとのチェック
        for (let c = 0; c < SIZE; c++) {
            let currentLine = [];
            for (let r = 0; r < SIZE; r++) currentLine.push(solverBoard[r][c]);
            
            const result = solveLine(currentLine, colHints[c]);
            if (result) {
                for (let r = 0; r < SIZE; r++) {
                    if (solverBoard[r][c] === 0 && result[r] !== 0) {
                        solverBoard[r][c] = result[r];
                        changed = true;
                    }
                }
            }
        }
    }

    // 全マス埋まったか確認 (1:黒, 2:白 が埋まっていればOK)
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (solverBoard[r][c] === 0) return false; // 解けない
        }
    }
    return true; // 解けた
}

// 1行分のロジックチェック (全パターン生成して共通部分を探す)
function solveLine(currentLine, hints) {
    // すでに判明している情報 (1:黒, 2:白, 0:不明)
    // 可能な配置パターンを全て生成し、矛盾しないものだけ残す
    
    const len = currentLine.length;
    const possibles = [];
    
    // 再帰でパターン生成
    function generate(index, hintIdx, currentPattern) {
        if (hintIdx === hints.length) {
            // 残りを白で埋める
            const remaining = len - index;
            if (remaining < 0) return; 
            const pattern = currentPattern.concat(Array(remaining).fill(2)); // 2=白
            if (isValid(pattern)) possibles.push(pattern);
            return;
        }
        
        const blockSize = hints[hintIdx];
        
        // ブロックを置ける位置を探す
        // 現在位置 index から、最大どこまで右にいけるか
        // 残りのヒントに必要な最低長さを考慮
        // (残りのブロック数 + 残りの隙間)
        let minRemaining = 0;
        for(let i=hintIdx+1; i<hints.length; i++) minRemaining += 1 + hints[i];
        
        const maxStart = len - minRemaining - blockSize;
        
        for (let start = index; start <= maxStart; start++) {
            // 前の空白 (start - index 個)
            const gapSize = start - index;
            let part = Array(gapSize).fill(2); // 白
            // ブロック (黒)
            part = part.concat(Array(blockSize).fill(1));
            // ブロックの後ろは必ず白(1つ) ただし最後なら不要
            if (hintIdx < hints.length - 1) {
                part.push(2); // 白
            }
            
            generate(start + blockSize + (hintIdx < hints.length - 1 ? 1 : 0), hintIdx + 1, currentPattern.concat(part));
        }
    }

    // パターンが現在の確定情報と矛盾していないかチェック
    function isValid(pattern) {
        if (pattern.length !== len) return false;
        for (let i = 0; i < len; i++) {
            if (currentLine[i] !== 0 && currentLine[i] !== pattern[i]) return false;
        }
        return true;
    }

    generate(0, 0, []);

    if (possibles.length === 0) return null; // 矛盾

    // 共通部分を探す
    const result = [...possibles[0]];
    for (let i = 1; i < possibles.length; i++) {
        for (let j = 0; j < len; j++) {
            if (result[j] !== possibles[i][j]) {
                result[j] = 0; // 一致しないなら不明
            }
        }
    }
    return result;
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
        hints.forEach(h => div.innerHTML += `<span>${h}</span>`);
        topHintsDiv.appendChild(div);
    }

    // 左ヒント
    for (let r = 0; r < SIZE; r++) {
        const hints = getHints(solution[r]);
        const div = document.createElement('div');
        div.className = 'hint-row';
        hints.forEach(h => div.innerHTML += `<span>${h}</span>`);
        leftHintsDiv.appendChild(div);
    }

    // 盤面
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            // 太線用のデータ属性
            cell.dataset.col = c;
            cell.dataset.row = r;

            cell.addEventListener('mousedown', (e) => startDrag(r, c));
            cell.addEventListener('mouseenter', () => continueDrag(r, c));
            boardDiv.appendChild(cell);
        }
    }
    
    window.addEventListener('mouseup', () => isMouseDown = false);
}

function updateCellVisual(r, c) {
    const index = r * SIZE + c;
    const cell = document.getElementById('board').children[index];
    cell.classList.remove('filled', 'crossed');
    if (userState[r][c] === 1) cell.classList.add('filled');
    if (userState[r][c] === 2) cell.classList.add('crossed');
}

function startDrag(r, c) {
    isMouseDown = true;
    applyAction(r, c);
}

function continueDrag(r, c) {
    if (isMouseDown) {
        applyAction(r, c);
    }
}

function applyAction(r, c) {
    // すでに同じ状態なら何もしない（上書き防止）
    if (userState[r][c] === currentMode) return;

    // 0(空)なら現在のモードで塗る。既に何かあれば消す(0に戻す)
    // ただし、ドラッグ中は「空の場所だけ塗る」挙動の方が自然な場合もあるが
    // ここでは単純に「現在のモードにする」処理（消しゴムなし）とするか、
    // あるいは「上書き」とする。
    // 要望の「塗りつぶす／バツをスライドボタンで選択」に従い、強制的にそのモードにする
    
    userState[r][c] = currentMode;
    updateCellVisual(r, c);
    
    // アクション後にオートバツ判定
    checkAutoCross(r, c);
    checkWin();
}

// --- 自動バツ機能 ---
function checkAutoCross(changedR, changedC) {
    // 行のチェック
    if (shouldAutoCrossLine(solution[changedR], userState[changedR])) {
        for (let c = 0; c < SIZE; c++) {
            if (userState[changedR][c] === 0) {
                userState[changedR][c] = 2; // バツにする
                updateCellVisual(changedR, c);
            }
        }
    }

    // 列のチェック
    let colSol = [], colUser = [];
    for(let r=0; r<SIZE; r++) {
        colSol.push(solution[r][changedC]);
        colUser.push(userState[r][changedC]);
    }
    
    if (shouldAutoCrossLine(colSol, colUser)) {
        for (let r = 0; r < SIZE; r++) {
            if (userState[r][changedC] === 0) {
                userState[r][changedC] = 2; // バツにする
                updateCellVisual(r, changedC);
            }
        }
    }
}

// そのラインにおいて、「塗るべきマスの総数」と「現在塗られているマスの数」が一致したらTrue
// ※より厳密にやるなら「位置」もチェックすべきだが、
// プレイヤー支援機能としては「数があったら残りはバツ」という挙動が一般的で分かりやすい
function shouldAutoCrossLine(solLine, userLine) {
    const targetCount = solLine.filter(x => x === 1).length;
    const currentCount = userLine.filter(x => x === 1).length;
    return targetCount === currentCount;
}

function checkWin() {
    // 簡易判定：黒マスの位置がすべて一致しているか
    // (バツの位置は問わない、未入力があっても黒が合っていればクリアとする場合もあるが、
    //  通常は完全一致)
    let correct = true;
    for(let r=0; r<SIZE; r++) {
        for(let c=0; c<SIZE; c++) {
            const sol = solution[r][c];
            const usr = userState[r][c];
            // 正解が黒(1)なら、ユーザーも黒(1)でなければならない
            // 正解が白(0)なら、ユーザーは黒(1)であってはいけない (白0かバツ2ならOK)
            if (sol === 1 && usr !== 1) correct = false;
            if (sol === 0 && usr === 1) correct = false;
        }
    }
    
    if (correct) {
        document.getElementById('status-message').textContent = "CLEARED! CONGRATULATIONS!";
    }
}