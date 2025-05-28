// --- グローバル設定 ---
const GAME_WIDTH = 800;  // 横長に変更
const GAME_HEIGHT = 450; // 横長に変更

// X座標の初期値 (横長に合わせて調整)
const PLAYER_X_RIGHT = GAME_WIDTH * 0.75; // プレイヤーは右固定 (斬撃後は左へ)
const PLAYER_X_LEFT = GAME_WIDTH * 0.25;
const CPU_X_LEFT = GAME_WIDTH * 0.25;     // CPUは左固定 (斬撃後は右へ)
const CPU_X_RIGHT = GAME_WIDTH * 0.75;

const CHARACTER_Y_POSITION = GAME_HEIGHT * 0.88; // キャラクターのY座標 (足元基準)
const CHARACTER_SCALE = 0.6; // キャラクターの表示スケール (0.1～1.0で調整)

// アセットキー
const ASSETS = {
    BG_MAIN: 'backgroundMain',
    PLAYER_IDLE: 'playerIdle', PLAYER_READY: 'playerReady', PLAYER_WIN: 'playerWin', PLAYER_LOSE: 'playerLose',
    CPU1_IDLE: 'CPU1_IDLE', CPU1_READY: 'CPU1_READY', CPU1_WIN: 'CPU1_WIN', CPU1_LOSE: 'CPU1_LOSE', // 1人目
    CPU2_IDLE: 'CPU2_IDLE', CPU2_READY: 'CPU2_READY', CPU2_WIN: 'CPU2_WIN', CPU2_LOSE: 'CPU2_LOSE', // 2人目
    CPU3_IDLE: 'CPU3_IDLE', CPU3_READY: 'CPU3_READY', CPU3_WIN: 'CPU3_WIN', CPU3_LOSE: 'CPU3_LOSE', // 3人目
    SIGNAL_MARK: 'signalMark',
    BGM_VERSUS: 'bgmVersus',
    SE_CLASH: 'seClash'
};

const DIFFICULTIES = { // CPUの強さ設定のみに使用
    easy:   { name: 'やさしい', minReact: 250, maxReact: 500, color: 0x88ff88 },
    normal: { name: 'ふつう',   minReact: 150, maxReact: 400, color: 0xffff88 },
    hard:   { name: 'つよい',   minReact: 100, maxReact: 250, color: 0xff8888 }
};
let currentDifficultyKey = 'normal'; // プレイヤーが選択する難易度
let cpuMinReact = DIFFICULTIES[currentDifficultyKey].minReact;
let cpuMaxReact = DIFFICULTIES[currentDifficultyKey].maxReact;

const MAX_OPPONENTS = 3;
let currentOpponentNumber = 1; // 1, 2, 3 (CPU1, CPU2, CPU3に対応)

let currentBgm = null;

// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
        
    }

    preload() {
        console.log('[LOG] TitleScene preload: Started');
        this.load.image(ASSETS.BG_MAIN, `assets/${ASSETS.BG_MAIN}.jpg`);
        this.load.audio(ASSETS.BGM_VERSUS, [`assets/${ASSETS.BGM_VERSUS}.mp3`, `assets/${ASSETS.BGM_VERSUS}.ogg`]);
        console.log('[LOG] TitleScene preload: Finished');
    }

    create() {
        console.log('[LOG] TitleScene create: Started');
        this.cameras.main.setBackgroundColor('#000000'); // 背景の余白を黒に
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSETS.BG_MAIN); // 背景画像は画面サイズに合わせて調整されるか、中央配置

        this.createTextObjects(); // テキストやボタンの生成

        this.playTitleBGM(); // BGM再生
        console.log('[LOG] TitleScene create: Finished');
    }

    playTitleBGM() {
        if (currentBgm && currentBgm.isPlaying && currentBgm.key === ASSETS.BGM_VERSUS) {
            // Do nothing if already playing the same BGM
            return;
        }
        if (currentBgm) {
            currentBgm.stop();
        }
        // 'this.sound.get' to check if already loaded by another scene (like GameScene)
        currentBgm = this.sound.get(ASSETS.BGM_VERSUS) || this.sound.add(ASSETS.BGM_VERSUS);
        if (currentBgm && !currentBgm.isPlaying) {
            currentBgm.play({ loop: true, volume: 0.4 });
            console.log('[LOG] TitleScene: BGM playing');
        } else if (!currentBgm) {
            console.error("[LOG] TitleScene: BGM asset not found or loaded.")
        }
    }

    createTextObjects() {
        console.log('[LOG] TitleScene createTextObjects: Started');
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2; // For centering some elements vertically

        // タイトルロゴ
        this.add.text(centerX, GAME_HEIGHT * 0.25, '刹那ファンタジー', { // Y位置調整
            fontSize: '52px', color: '#FFFFFF', fontStyle: 'bold',
            // fontFamily: 'Arial' // フォント指定が必要なら
        }).setOrigin(0.5).setStroke('#000000', 6);

        this.add.text(centerX, GAME_HEIGHT * 0.42, 'VERSUS:RISING', { // Y位置調整
            fontSize: '60px', color: '#FFFF00', fontStyle: 'italic bold',
            // fontFamily: 'Impact'
        }).setOrigin(0.5).setStroke('#000000', 6);

        // 難易度選択ボタン
        let yPos = GAME_HEIGHT * 0.68; // ボタン群の開始Y位置調整
        const buttonWidth = GAME_WIDTH * 0.30; // ボタン幅調整
        const buttonHeight = 50; // ボタン高さ調整
        const buttonSpacing = 10; // ボタン間のY方向の間隔

        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(centerX, yPos, buttonWidth, buttonHeight, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficultyKey = diffKey;
                    currentOpponentNumber = 1;
                    this.scene.start('GameScene', { difficulty: currentDifficultyKey, opponentNum: currentOpponentNumber });
                });
            this.add.text(button.x, button.y, diff.name, {
                fontSize: '24px', color: '#000000', fontStyle: 'bold' // ボタン内テキストサイズ調整
            }).setOrigin(0.5);
            yPos += buttonHeight + buttonSpacing;
        }

        // スコア表示 (左上に配置)
        const scoreXStart = GAME_WIDTH * 0.05; // X位置調整
        const scoreYStart = GAME_HEIGHT * 0.1; // Y位置調整
        const scoreLineHeight = 22; // スコア各行の高さ

        this.add.text(scoreXStart, scoreYStart, '--- 戦績 ---', {
            fontSize: '18px', color: '#DDDDDD' // サイズ調整
        }).setOrigin(0, 0.5).setStroke('#000000', 3);

        const bestTime = localStorage.getItem('bestReactionTime') || '-';
        this.add.text(scoreXStart, scoreYStart + scoreLineHeight, `最速反応: ${bestTime}${bestTime !== '-' ? ' ms' : ''}`, {
            fontSize: '16px', color: '#CCCCCC' // サイズ調整
        }).setOrigin(0, 0.5).setStroke('#000000', 3);

        let currentScoreLineY = scoreYStart + scoreLineHeight * 2;
        for (const diffKey in DIFFICULTIES) {
            const clears = localStorage.getItem(`${diffKey}_clears`) || '0';
            this.add.text(scoreXStart, currentScoreLineY, `${DIFFICULTIES[diffKey].name} クリア: ${clears}回`, {
                fontSize: '14px', color: '#AAAAAA' // サイズ調整
            }).setOrigin(0, 0.5).setStroke('#000000', 2);
            currentScoreLineY += scoreLineHeight * 0.8; // 行間調整
        }
        console.log('[LOG] TitleScene createTextObjects: Finished');
        // ★★★ Firebaseからランキングを読み込んで表示 ★★★
        const rankingYStart = GAME_HEIGHT * 0.6; // 表示開始位置 (調整してください)
        const rankingTitle = this.add.text(GAME_WIDTH * 0.75, rankingYStart - 30, '--- 団内ランキング ---', {
            fontSize: '20px', color: '#FFD700' // 金色っぽく
        }).setOrigin(0.3).setStroke('#000000', 3);

        // Firebaseが初期化されるまで少し待つか、フラグを確認する
     // TitleScene の createTextObjects メソッド内 (ランキング表示部分)
     // rankingTexts 配列をここで確実に初期化 (または constructor で)
        if (!this.rankingTexts) { // まだ初期化されていなければ
            this.rankingTexts = [];
        } else { // 既に存在する場合は古いものをクリア
            this.rankingTexts.forEach(text => { if(text && text.destroy) text.destroy(); }); // nullチェックとdestroy存在チェック
            this.rankingTexts = [];
        }

              const checkFirebaseAndLoadRanking = () => {
            if (typeof window.firebaseInitialized !== 'undefined' && window.firebaseInitialized && typeof window.firebaseDatabase !== 'undefined') {
                console.log('[TitleScene] Firebase is initialized, loading ranking...');
                const databaseToUse = window.firebaseDatabase;
                const scoresRef = databaseToUse.ref('scores');
                scoresRef.orderByChild('score').limitToFirst(5).once('value', (snapshot) => {
                    if (this.rankingTexts && this.rankingTexts.length > 0) {
                        this.rankingTexts.forEach(text => { if(text && text.destroy) text.destroy(); });
                    }
                    this.rankingTexts = [];

                    if (snapshot.exists()) {
                        let y = rankingYStart;
                        let rank = 1;
                        snapshot.forEach((childSnapshot) => {
                            // ★★★ try をここに追加 ★★★
                            try {
                                const scoreData = childSnapshot.val();
                                if (scoreData && typeof scoreData.score === 'number') {
                                    const displayName = scoreData.name || "名無し";
                                    const rankText = this.add.text(GAME_WIDTH * 0.75, y,
                                        `${rank}. ${displayName} - ${scoreData.score.toFixed(0)} ms (${scoreData.difficulty || 'N/A'})`, {
                                        fontSize: '16px', color: '#FFFFFF'
                                    }).setOrigin(0.5, 0).setStroke('#000000', 2);
                                    this.rankingTexts.push(rankText);
                                    y += 20;
                                    rank++;
                                } else {
                                    console.warn('[TitleScene] Invalid score data found in forEach:', scoreData);
                                }
                            // ★★★ catch はこの try に対応 ★★★
                            } catch (e) {
                                console.error('[TitleScene] Error processing one ranking entry:', e, 'Data:', childSnapshot.val());
                            }
                        }); // snapshot.forEach の閉じ括弧
                    } else {
                        const noDataText = this.add.text(GAME_WIDTH * 0.75, rankingYStart, '(まだ記録がありません)', { fontSize: '16px', color: '#AAAAAA' }).setOrigin(0.5, 0).setStroke('#000000', 2);
                        this.rankingTexts.push(noDataText);
                    }
                }, (errorObject) => {
                    console.error('[Firebase] Ranking read failed:', errorObject.name, errorObject.message); // エラーオブジェクトの内容も表示
                    if (this.rankingTexts && this.rankingTexts.length > 0) { this.rankingTexts.forEach(text => { if(text && text.destroy) text.destroy(); }); }
                    this.rankingTexts = [];
                    const errorText = this.add.text(GAME_WIDTH * 0.75, rankingYStart, '(ランキング取得エラー)', { fontSize: '16px', color: '#FF8888' }).setOrigin(0.5, 0).setStroke('#000000', 2);
                    this.rankingTexts.push(errorText);
                });
            } else if (typeof window.firebaseInitialized !== 'undefined' && !window.firebaseInitialized) {
                if (this.rankingTexts && this.rankingTexts.length > 0) { this.rankingTexts.forEach(text => { if(text && text.destroy) text.destroy(); }); }
                this.rankingTexts = [];
                const initErrorText = this.add.text(GAME_WIDTH * 0.75, rankingYStart, '(ランキング機能エラー)', { fontSize: '16px', color: '#FF8888' }).setOrigin(0.5, 0).setStroke('#000000', 2);
                this.rankingTexts.push(initErrorText);
            }
            else {
                this.time.delayedCall(500, checkFirebaseAndLoadRanking, [], this);
            }
        };
        checkFirebaseAndLoadRanking(); // チェック開始
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    }
}


// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerSprite = null; this.cpuSprite = null; this.signalObject = null;
        this.infoText = null; this.resultText = null;
        this.gameState = 'waiting'; this.signalTime = undefined; this.playerReactTime = undefined;
        this.cpuReactTime = undefined; this.playerInputEnabled = false; this.cpuTimer = null;
        this.signalTimer = null; this.playerIsLeft = false; this.winLastRound = false;
         this.bestReactionTimeInSeries = Infinity; // ★現在の3連戦中の最速タイムを保持する変数★
    }

    init(data) {
        console.log('[LOG] GameScene init: Started with data:', data);
        currentDifficultyKey = (data && data.difficulty !== undefined) ? data.difficulty : 'normal';
        currentOpponentNumber = (data && data.opponentNum !== undefined) ? data.opponentNum : 1;

        const diffSetting = DIFFICULTIES[currentDifficultyKey];
        cpuMinReact = diffSetting.minReact;
        cpuMaxReact = diffSetting.maxReact;
        if (currentDifficultyKey === 'hard') {
            const reductionFactor = (currentOpponentNumber - 1) * 10;
            cpuMinReact = Math.max(70, cpuMinReact - reductionFactor);
            cpuMaxReact = Math.max(130, cpuMaxReact - reductionFactor * 1.2);
            if (cpuMinReact >= cpuMaxReact - 10) cpuMinReact = cpuMaxReact - 20;
        }
        this.gameState = 'waiting';
         this.bestReactionTimeInSeries = Infinity; // ★各難易度挑戦開始時にリセット★
        console.log(`[LOG] GameScene init: Opponent ${currentOpponentNumber}, CPU Strength (from ${currentDifficultyKey}): ${cpuMinReact}-${cpuMaxReact}ms. gameState: ${this.gameState}`);
    }

    preload() {
        console.log('[LOG] GameScene preload: Started');
        if (!this.textures.exists(ASSETS.BG_MAIN)) { // TitleSceneでロード済みのはずだが念のため
            this.load.image(ASSETS.BG_MAIN, `assets/${ASSETS.BG_MAIN}.jpg`);
        }
        this.load.image(ASSETS.PLAYER_IDLE, `assets/${ASSETS.PLAYER_IDLE}.png`);
        this.load.image(ASSETS.PLAYER_READY, `assets/${ASSETS.PLAYER_READY}.png`);
        this.load.image(ASSETS.PLAYER_WIN, `assets/${ASSETS.PLAYER_WIN}.png`);
        this.load.image(ASSETS.PLAYER_LOSE, `assets/${ASSETS.PLAYER_LOSE}.png`);
        for (let i = 1; i <= 3; i++) {
            this.load.image(`CPU${i}_IDLE`, `assets/CPU${i}_IDLE.png`);
            this.load.image(`CPU${i}_READY`, `assets/CPU${i}_READY.png`);
            this.load.image(`CPU${i}_WIN`, `assets/CPU${i}_WIN.png`);
            this.load.image(`CPU${i}_LOSE`, `assets/CPU${i}_LOSE.png`);
        }
        this.load.image(ASSETS.SIGNAL_MARK, `assets/${ASSETS.SIGNAL_MARK}.png`);
        this.load.audio(ASSETS.SE_CLASH, [`assets/${ASSETS.SE_CLASH}.mp3`, `assets/seClash.mp3`]);
        if (!this.sound.get(ASSETS.BGM_VERSUS)) { // TitleSceneでロード済みのはずだが念のため
            this.load.audio(ASSETS.BGM_VERSUS, [`assets/${ASSETS.BGM_VERSUS}.mp3`, `assets/${ASSETS.BGM_VERSUS}.ogg`]);
        }
        console.log('[LOG] GameScene preload: Finished');
    }

    create() {
        console.log('[LOG] GameScene create: Started');
        this.cameras.main.setBackgroundColor('#000000'); // 背景の余白を黒に
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSETS.BG_MAIN);

        this.playerSprite = this.add.image(0,0, ASSETS.PLAYER_IDLE).setOrigin(0.5, 1).setScale(CHARACTER_SCALE);
        const cpuAssetKeyPrefix = `CPU${currentOpponentNumber}`;
        this.cpuSprite = this.add.image(0,0, `${cpuAssetKeyPrefix}_IDLE`).setOrigin(0.5, 1).setScale(CHARACTER_SCALE);

        this.signalObject = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.40, ASSETS.SIGNAL_MARK) // Y位置調整
            .setOrigin(0.5).setVisible(false).setScale(1.1); // スケール調整

        this.infoText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.12, '', { // Y位置、フォントサイズ調整
            fontSize: '26px', color: '#FFFFFF', align: 'center', lineSpacing: 6
        }).setOrigin(0.5).setStroke('#000000', 4);

        this.resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, '', { // Y位置、フォントサイズ調整
            fontSize: '30px', color: '#FFFFFF', align: 'center', lineSpacing: 8
        }).setOrigin(0.5).setStroke('#000000', 5);

        this.setGameState(this.gameState);

        this.input.off('pointerdown', this.handlePlayerInput, this);
        this.input.on('pointerdown', this.handlePlayerInput, this);
        console.log('[LOG] GameScene create: Finished');
    }

    playGameBGM() {
        if (currentBgm && currentBgm.isPlaying && currentBgm.key === ASSETS.BGM_VERSUS) return;
        if (currentBgm) currentBgm.stop();
        currentBgm = this.sound.get(ASSETS.BGM_VERSUS) || this.sound.add(ASSETS.BGM_VERSUS);
        if (currentBgm && !currentBgm.isPlaying) {
            currentBgm.play({ loop: true, volume: 0.4 });
            console.log('[LOG] GameScene: BGM playing');
        } else if (!currentBgm) {
             console.error("[LOG] GameScene: BGM asset not found or loaded.")
        }
    }

    stopGameBGM() {
        if (currentBgm && currentBgm.isPlaying) {
            currentBgm.stop();
            console.log('[LOG] GameScene: BGM stopped');
        }
    }

    setGameState(newState) {
        console.log(`[LOG] setGameState: Changing from ${this.gameState} to ${newState}`);
        this.gameState = newState; this.playerInputEnabled = false;
        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }
        const cpuAssetKeyPrefix = `CPU${currentOpponentNumber}`;

        switch (this.gameState) {
            case 'waiting':
                this.playGameBGM();
                if(this.playerSprite) this.playerSprite.setVisible(true).setTexture(ASSETS.PLAYER_IDLE);
                if(this.cpuSprite) this.cpuSprite.setVisible(true).setTexture(`${cpuAssetKeyPrefix}_IDLE`);
                if(this.infoText) this.infoText.setText(`相手 ${currentOpponentNumber}人目\n画面をタップして開始`);
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);
                this.playerIsLeft = false;
                if(this.playerSprite) this.playerSprite.setPosition(PLAYER_X_RIGHT, CHARACTER_Y_POSITION);
                if(this.cpuSprite) this.cpuSprite.setPosition(CPU_X_LEFT, CHARACTER_Y_POSITION);
                this.playerReactTime = undefined; this.cpuReactTime = undefined; this.signalTime = undefined;
                this.playerInputEnabled = true;
                break;
            case 'ready':
                if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_READY);
                if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_READY`);
                if(this.infoText) this.infoText.setText('構え！');
                this.playerInputEnabled = true;
                const waitTime = Phaser.Math.Between(1500, 3500);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                break;
            case 'signal':
                if(this.infoText) this.infoText.setText('斬！');
                if(this.signalObject) this.signalObject.setVisible(true);
                this.signalTime = this.time.now; this.playerInputEnabled = true;
                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                break;
            case 'result':
                this.stopGameBGM(); this.playerInputEnabled = false;
                if(this.signalObject) this.signalObject.setVisible(false);
                this.time.delayedCall(600, () => { this.playerInputEnabled = true; });
                break;
            default: console.warn(`[LOG] setGameState: Unknown state ${newState}`);
        }
    }

    showSignal() { if (this.gameState === 'ready') this.setGameState('signal'); }

    handlePlayerInput() {
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;
        if (this.gameState === 'waiting') this.setGameState('ready');
        else if (this.gameState === 'ready') {
            this.playerReactTime = -1; this.cpuReactTime = 99999;
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            this.performResultLogic();
        } else if (this.gameState === 'signal') {
            this.playerReactTime = currentTime - this.signalTime; this.playerInputEnabled = false;
            if (this.cpuReactTime !== undefined) this.showResult();
        } else if (this.gameState === 'result') {
            if (this.winLastRound) { // 前のラウンドで勝った場合
                if (currentOpponentNumber < MAX_OPPONENTS) { // まだ次の相手がいる
                    currentOpponentNumber++;
                    this.scene.restart({ difficulty: currentDifficultyKey, opponentNum: currentOpponentNumber });
                } else { // 3人抜き達成！
                    console.log('[LOG] All opponents defeated! Current series best time:', this.bestReactionTimeInSeries);
                    // ★★★ ここで名前入力と最速スコアの保存を行う ★★★
                    if (this.bestReactionTimeInSeries !== Infinity) { // 有効な記録がある場合のみ
                        let playerName = localStorage.getItem('playerName');
                        if (!playerName) {
                             playerName = prompt("ランキング登録名 (10文字以内):", "挑戦者");
                        } else {
                             playerName = prompt("ランキング登録名 (10文字以内):", playerName);
                        }

                        if (playerName && playerName.trim() !== "") {
                            playerName = playerName.trim().substring(0, 10);
                            localStorage.setItem('playerName', playerName);

                            if (typeof window.firebaseDatabase !== 'undefined' && typeof window.firebaseInitialized !== 'undefined' && window.firebaseInitialized) {
                                try {
                                    const databaseToUse = window.firebaseDatabase;
                                    const scoresRef = databaseToUse.ref('scores');
                                    const newScoreRef = scoresRef.push();
                                    newScoreRef.set({
                                        name: playerName,
                                        score: this.bestReactionTimeInSeries, // ★シリーズ中の最速タイムを保存★
                                        difficulty: currentDifficultyKey,
                                        timestamp: firebase.database.ServerValue.TIMESTAMP
                                    })
                                    .then(() => {
                                        console.log('[Firebase] Best series score saved successfully!');
                                        if(this.resultText) this.resultText.setText(this.resultText.text + '\nランキング登録完了！\nタップしてタイトルへ');
                                    })
                                    .catch((error) => {
                                        console.error('[Firebase] Error saving best series score: ', error);
                                        if(this.resultText) this.resultText.setText(this.resultText.text + '\nランキング登録失敗…\nタップしてタイトルへ');
                                    });
                                } catch (e) {
                                    console.error('[Firebase] Exception while trying to save best series score: ', e);
                                    if(this.resultText) this.resultText.setText(this.resultText.text + '\nランキング登録エラー…\nタップしてタイトルへ');
                                }
                            } else {
                                console.warn('[Firebase] Database not initialized, score not saved to online ranking.');
                                if(this.resultText) this.resultText.setText(this.resultText.text + '\n(オンラインランキングオフライン)\nタップしてタイトルへ');
                            }
                        } else {
                            console.log("Player name not provided for series best, score not saved to online ranking.");
                            if(this.resultText) this.resultText.setText(this.resultText.text + '\n(名前未入力のため登録スキップ)\nタップしてタイトルへ');
                        }
                    } else {
                         if(this.resultText) this.resultText.setText(this.resultText.text + '\n(有効な記録なし)\nタップしてタイトルへ');
                    }
                    this.winLastRound = false; // 次のタップはタイトルへ戻るように
                    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
                }
            } else { // 敗北または3人抜き達成後の(名前入力後の)タップ
                this.scene.start('TitleScene');
            }
        }
    
    }

    handleCpuInput() {
        if (this.gameState !== 'signal' || this.signalTime === undefined) return;
        this.cpuReactTime = this.time.now - this.signalTime;
        if (this.playerReactTime === undefined) { this.playerReactTime = 9999; this.playerInputEnabled = false; }
        this.showResult();
    }

     showResult() {
        console.log(`[LOG] showResult: Called in state ${this.gameState}. PlayerReactTime: ${this.playerReactTime}`); // ★ログ追加★
        if (this.gameState !== 'signal' && this.playerReactTime !== -1) {
             console.warn(`[LOG] showResult: Called in unexpected state ${this.gameState} and not a false start. Bailing.`);
             return;
        }

        console.log('[LOG] showResult: Playing SE_CLASH'); // ★ログ追加★
        try {
            this.sound.play(ASSETS.SE_CLASH, {volume: 0.6});
            console.log('[LOG] showResult: SE_CLASH played (or at least attempted)'); // ★ログ追加★
        } catch (e) {
            console.error('[ERROR LOG] showResult: Error playing SE_CLASH', e); // ★エラーキャッチ★
        }


        console.log('[LOG] showResult: Creating flash rectangle'); // ★ログ追加★
        let flash = null; // スコープを広げる
        try {
            flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.5).setDepth(100);
            console.log('[LOG] showResult: Flash rectangle created'); // ★ログ追加★
        } catch (e) {
            console.error('[ERROR LOG] showResult: Error creating flash rectangle', e); // ★エラーキャッチ★
        }


        console.log('[LOG] showResult: Scheduling flash destroy'); // ★ログ追加★
        this.time.delayedCall(60, () => {
            console.log('[LOG] showResult (delayedCall for flash.destroy): Attempting to destroy flash'); // ★ログ追加★
            if(flash && flash.active) { // flashがnullでないことも確認
                try {
                    flash.destroy();
                    console.log('[LOG] showResult (delayedCall for flash.destroy): Flash destroyed'); // ★ログ追加★
                } catch(e) {
                    console.error('[ERROR LOG] showResult: Error destroying flash', e);
                }
            } else {
                console.warn('[LOG] showResult (delayedCall for flash.destroy): Flash is null or inactive');
            }
        });

        console.log('[LOG] showResult: Scheduling position swap and performResultLogic'); // ★ログ追加★
        this.time.delayedCall(70, () => {
            console.log('[LOG] showResult (delayedCall for logic): Performing position swap'); // ★ログ追加★
            try {
                this.playerIsLeft = !this.playerIsLeft;
                if(this.playerSprite) this.playerSprite.setX(this.playerIsLeft ? PLAYER_X_LEFT : PLAYER_X_RIGHT);
                if(this.cpuSprite) this.cpuSprite.setX(this.playerIsLeft ? CPU_X_RIGHT : CPU_X_LEFT);
                console.log('[LOG] showResult (delayedCall for logic): Position swapped, calling performResultLogic'); // ★ログ追加★
                this.performResultLogic();
            } catch (e) {
                console.error('[ERROR LOG] showResult: Error in position swap or calling performResultLogic', e);
            }
        });
        console.log('[LOG] showResult: Finished scheduling delayed calls'); // ★ログ追加★
    }

       // performResultLogic メソッドの修正
    performResultLogic() {
        if (this.gameState === 'result' && this.resultText && this.resultText.text !== '' && this.resultText.text.includes('タップして')) { return; }
        this.stopGameBGM();
        this.setGameState('result'); // gameState を 'result' にするのはここが最初が良い
        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false;
        const cpuAssetKeyPrefix = `CPU${currentOpponentNumber}`;


        if (pReact === -1) {
            message = `お手つき！\nあなたの負け`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_WIN`);
        } else if (pReact === 9999 && cReact < 9999) {
            message = `遅い！\nあなたの負け\n(相手: ${cReact.toFixed(0)} ms)`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_WIN`);
       } else if (pReact < cReact) { // プレイヤー勝利
            message = `あなたの勝ち！\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_WIN);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_LOSE`);
            this.winLastRound = true;
            this.updateBestReaction(pReact); // ローカルの総合最速は毎回更新

            // ★★★ 今回のシリーズ中の最速タイムを更新 ★★★
            if (pReact < this.bestReactionTimeInSeries) {
                this.bestReactionTimeInSeries = pReact;
                console.log(`[LOG] New best reaction time in series: ${this.bestReactionTimeInSeries.toFixed(0)} ms`);
            }
            // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        } else if (pReact > cReact) {
            message = `あなたの負け\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_WIN`);
        } else if (pReact === cReact && pReact !== 9999 && pReact !== -1 && pReact !== Infinity) {
            message = `引き分け！\n\n両者: ${pReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_IDLE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_IDLE`);
        } else {
            message = `勝負つかず！`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_IDLE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetKeyPrefix}_IDLE`);
        }
         if (this.winLastRound) {
            if (currentOpponentNumber < MAX_OPPONENTS) {
                message += `\n\nタップして次の相手へ`;
            } else { // 3人抜き達成
                message += `\n\n${DIFFICULTIES[currentDifficultyKey].name} 制覇！`; // 名前入力指示は handlePlayerInput へ
                this.updateClearCount(currentDifficultyKey);
                // ★★★ 名前入力とスコア保存はここでは行わない (handlePlayerInput へ移動) ★★★
            }
        } else {
             message += `\n\nタップしてタイトルへ`;
        }
        if(this.resultText) this.resultText.setText(message);
    }

    updateBestReaction(reactionTime) {
        if (reactionTime < 0 || reactionTime >= 9999) return;
        const bestTime = parseFloat(localStorage.getItem('bestReactionTime')) || Infinity;
        if (reactionTime < bestTime) localStorage.setItem('bestReactionTime', reactionTime.toFixed(0));
    }
    updateClearCount(difficultyKey) {
        const key = `${difficultyKey}_clears`; let clears = parseInt(localStorage.getItem(key)) || 0;
        clears++; localStorage.setItem(key, clears.toString());
    }
}

// --- Phaserゲーム設定 ---
const config = {
    type: Phaser.AUTO, width: GAME_WIDTH, height: GAME_HEIGHT, parent: 'game-container',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [TitleScene, GameScene]
};
// --- Phaserゲームの初期化 ---
const game = new Phaser.Game(config);

/* --- アセットファイル名一覧 (仮) ---
   assets/ フォルダ直下に配置
// 背景
backgroundMain.png
// 主人公
playerIdle.png, playerReady.png, playerWin.png, playerLose.png
// CPU1 (1人目)
CPU1_IDLE.png, CPU1_READY.png, CPU1_WIN.png, CPU1_LOSE.png
// CPU2 (2人目)
CPU2_IDLE.png, CPU2_READY.png, CPU2_WIN.png, CPU2_LOSE.png
// CPU3 (3人目)
CPU3_IDLE.png, CPU3_READY.png, CPU3_WIN.png, CPU3_LOSE.png
// 合図マーク
signalMark.png
// 音声
bgmVersus.mp3 (or .ogg), seClash.wav (or .mp3)
------------------------------------ */