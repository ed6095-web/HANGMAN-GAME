document.addEventListener('DOMContentLoaded', () => {
    let selectedWord = '';
    let guessedLetters = [];
    let incorrectGuesses = 0;
    const maxIncorrectGuesses = 6;
    let currentDifficulty = 'moderate'; // Default difficulty

    // Hint related variables
    let hintsRemaining = 0;
    let maxHints = 0;

    // Options feature variables
    let optionsUsesRemaining = 0;
    let maxOptionsUses = 0;
    let decoyWords = []; // To store the incorrect word options

    // Sound Effects
    const correctSound = new Audio('assets/sounds/correct_sound.mp3');
    const incorrectSound = new Audio('assets/sounds/incorrect_sound.mp3');
    const winSound = new Audio('assets/sounds/win_sound.mp3');
    const loseSound = new Audio('assets/sounds/lose_sound.mp3');
    const hintUsedSound = new Audio('assets/sounds/hint_sound.mp3');
    const modeChangeSound = new Audio('assets/sounds/mode_change_sound.mp3');
    const resetSound = new Audio('assets/sounds/reset_sound.mp3');
    const optionUsedSound = new Audio('assets/sounds/hint_sound.mp3'); // Re-use hint sound or add a new one

    const wordDisplay = document.getElementById('word-display');
    const guessesLeftDisplay = document.getElementById('guesses-left');
    const keyboardContainer = document.getElementById('keyboard');
    const hangmanParts = document.querySelectorAll('.body-part');
    const resetButton = document.getElementById('reset-button');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverMessage = document.getElementById('game-over-message');
    const correctWordDisplay = document.getElementById('correct-word-display');
    const playAgainButton = document.getElementById('play-again-button');
    const gameContainer = document.getElementById('game-container');
    const confettiContainer = document.getElementById('confetti-container');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
    
    const hintButton = document.getElementById('hint-button');
    const hintsRemainingDisplay = document.getElementById('hints-remaining');

    // New Options Button Elements
    const optionsButton = document.getElementById('options-button');
    const optionsUsesRemainingDisplay = document.getElementById('options-uses-remaining');
    const wordOptionsModal = document.getElementById('word-options-modal');
    const wordOptionsDisplay = document.getElementById('word-options-display');
    const wordOptionsLoadingText = document.getElementById('word-options-loading');


    const RANDOM_WORD_API_URL_BASE = 'https://random-word-api.herokuapp.com/word';

    difficultyRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value !== currentDifficulty) {
                if (modeChangeSound) modeChangeSound.play().catch(e => console.error("Error playing mode change sound:", e));
            }
            currentDifficulty = this.value;
            difficultyRadios.forEach(r => r.checked = (r.value === currentDifficulty));
            initializeGame();
        });
    });

    hintButton.addEventListener('click', useHint);
    optionsButton.addEventListener('click', showWordOptions); // Add event listener

    resetButton.addEventListener('click', () => {
        if (resetSound) resetSound.play().catch(e => console.error("Error playing reset sound:", e));
        initializeGame();
    });

    playAgainButton.addEventListener('click', () => {
        if (resetSound) resetSound.play().catch(e => console.error("Error playing reset sound:", e));
        initializeGame();
    });

    function setMaxHints() {
        switch (currentDifficulty) {
            case 'easy': maxHints = 2; break;
            case 'moderate': maxHints = 3; break; // Adjusted as per user code
            case 'hard': maxHints = 4; break;   // Adjusted as per user code
            default: maxHints = 1;
        }
        hintsRemaining = maxHints;
    }
    
    // Set max uses for the "Options" feature based on difficulty
    function setMaxOptionsUses() {
        switch (currentDifficulty) {
            case 'easy': maxOptionsUses = 2; break;
            case 'moderate': maxOptionsUses = 3; break;
            case 'hard': maxOptionsUses = 4; break; // Or 0 if you want it harder
            default: maxOptionsUses = 1;
        }
        optionsUsesRemaining = maxOptionsUses;
    }


    function updateHintButtonUI() {
        if (hintsRemainingDisplay) {
            hintsRemainingDisplay.textContent = `(${hintsRemaining} left)`;
        }
        if (hintButton) {
            const gameIsOver = incorrectGuesses >= maxIncorrectGuesses || (selectedWord && selectedWord.split('').every(char => guessedLetters.includes(char)));
            hintButton.disabled = hintsRemaining <= 0 || !selectedWord || gameIsOver;
        }
    }

    // Update UI for the "Options" button
    function updateOptionsButtonUI() {
        if (optionsUsesRemainingDisplay) {
            optionsUsesRemainingDisplay.textContent = `(${optionsUsesRemaining} left)`;
        }
        if (optionsButton) {
            const gameIsOver = incorrectGuesses >= maxIncorrectGuesses || (selectedWord && selectedWord.split('').every(char => guessedLetters.includes(char)));
            optionsButton.disabled = optionsUsesRemaining <= 0 || !selectedWord || gameIsOver || wordOptionsModal.style.display === 'flex';
        }
    }


    function useHint() {
        // ... (existing useHint function remains the same)
        // just ensure updateOptionsButtonUI() is called if hints and options might interact
        if (hintsRemaining <= 0 || !selectedWord) return;

        const unrevealedLetters = selectedWord.split('').filter(letter => !guessedLetters.includes(letter));

        if (unrevealedLetters.length > 0) {
            if (hintUsedSound) hintUsedSound.play().catch(e => console.error("Error playing hint sound:", e));

            const hintLetter = unrevealedLetters[Math.floor(Math.random() * unrevealedLetters.length)];
            const keyButtons = keyboardContainer.querySelectorAll('.key-button');
            let letterButtonElement;
            keyButtons.forEach(btn => {
                if (btn.textContent === hintLetter) {
                    letterButtonElement = btn;
                }
            });

            if (letterButtonElement && !letterButtonElement.disabled) {
                guessedLetters.push(hintLetter);
                letterButtonElement.disabled = true;
                letterButtonElement.classList.add('correct');
                
                updateWordDisplay();
                checkWinCondition();

                hintsRemaining--;
                updateHintButtonUI();
            }
        }
    }

    async function fetchSingleWordWithFallback(lengthConstraint, excludeWords = []) {
        let wordLengthMin, wordLengthMax, targetLength;
        const maxOverallAttempts = 3, maxAttemptsPerLength = 2; // Reduced attempts for decoys

        if (typeof lengthConstraint === 'number') {
            targetLength = lengthConstraint;
            wordLengthMin = lengthConstraint;
            wordLengthMax = lengthConstraint;
        } else { // difficulty string
            switch (lengthConstraint) { // Using difficulty to set range
                case 'easy': wordLengthMin = 3; wordLengthMax = 5; break;
                case 'hard': wordLengthMin = 9; wordLengthMax = 12; break;
                case 'moderate': default: wordLengthMin = 6; wordLengthMax = 8; break;
            }
            targetLength = Math.floor(Math.random() * (wordLengthMax - wordLengthMin + 1)) + wordLengthMin;
        }


        for (let overallAttempt = 0; overallAttempt < maxOverallAttempts; overallAttempt++) {
            if (typeof lengthConstraint !== 'number') { // if using difficulty, pick a new target length
                 targetLength = Math.floor(Math.random() * (wordLengthMax - wordLengthMin + 1)) + wordLengthMin;
            }
            try {
                for (let attempt = 0; attempt < maxAttemptsPerLength; attempt++) {
                    const response = await fetch(`${RANDOM_WORD_API_URL_BASE}?length=${targetLength}`);
                    if (!response.ok) continue;
                    const data = await response.json();
                    const word = data[0] ? data[0].toUpperCase() : null;
                    if (word && /^[A-Z]+$/.test(word) && word.length === targetLength && !excludeWords.includes(word)) {
                        return word;
                    }
                }
            } catch (error) { console.error(`Decoy fetch err (len ${targetLength}):`, error); }
        }
        
        // Fallback for single word if API fails
        console.warn("Fallback: Using predefined word for decoy/single fetch.");
        const difficultyForFallback = typeof lengthConstraint === 'number' ? currentDifficulty : lengthConstraint;
        const fallbacks = {
            "easy": ["SKY", "PIE", "JOY", "FOUR", "FIVE"],
            "moderate": ["ACTIVE", "SILVER", "PYTHON", "ROCKET", "WATER"],
            "hard": ["AMAZING", "COMPUTER", "ADVENTURE", "FRIENDLY", "ELECTRIC"]
        };
        let set = fallbacks[difficultyForFallback] || fallbacks["moderate"];
        set = set.filter(w => !excludeWords.includes(w) && (typeof lengthConstraint === 'number' ? w.length === lengthConstraint : true));
        if (set.length > 0) return set[Math.floor(Math.random() * set.length)];
        
        // Ultimate fallback if specific length fails and filtered list is empty
        const anyFallbackSet = fallbacks[difficultyForFallback] || fallbacks["moderate"];
        return anyFallbackSet.filter(w => !excludeWords.includes(w))[0] || "FALLBACK"; // Default to a generic if all else fails
    }


    async function fetchRandomWord() {
        let wordLengthMin, wordLengthMax, targetLength;
        const maxOverallAttempts = 5, maxAttemptsPerLength = 3;

        switch (currentDifficulty) {
            case 'easy': wordLengthMin = 3; wordLengthMax = 5; break;
            case 'hard': wordLengthMin = 9; wordLengthMax = 12; break;
            case 'moderate':
            default: wordLengthMin = 6; wordLengthMax = 8; break;
        }

        for (let overallAttempt = 0; overallAttempt < maxOverallAttempts; overallAttempt++) {
            targetLength = Math.floor(Math.random() * (wordLengthMax - wordLengthMin + 1)) + wordLengthMin;
            try {
                // Try fetching multiple words of the target length first, to have potential decoys ready
                const response = await fetch(`${RANDOM_WORD_API_URL_BASE}?length=${targetLength}&number=3`); // Fetch 3
                if (response.ok) {
                    const data = await response.json();
                    const validWords = data.map(w => w ? w.toUpperCase() : null).filter(w => w && /^[A-Z]+$/.test(w) && w.length === targetLength);
                    if (validWords.length > 0) {
                         // selectedWord = validWords[0]; // Keep the first one as main
                         // decoyWords = validWords.slice(1,3); // Store others if needed later - this is for options
                         return validWords[0]; // Just return the selected word here
                    }
                }
                 // If fetching 3 failed, try fetching 1
                for (let attempt = 0; attempt < maxAttemptsPerLength; attempt++) {
                    const singleResponse = await fetch(`${RANDOM_WORD_API_URL_BASE}?length=${targetLength}`);
                    if (!singleResponse.ok) {
                        if (attempt === maxAttemptsPerLength - 1) break;
                        continue;
                    }
                    const singleData = await singleResponse.json();
                    const word = singleData[0] ? singleData[0].toUpperCase() : null;
                    if (word && /^[A-Z]+$/.test(word) && word.length === targetLength) return word;
                }
            } catch (error) { console.error(`Err fetch len ${targetLength}:`, error); }
        }
        console.warn("Fallback: Fetching any random word (main selection).");
        try {
            const response = await fetch(RANDOM_WORD_API_URL_BASE);
            if (!response.ok) throw new Error("Fallback API fail");
            const data = await response.json();
            const word = data[0] ? data[0].toUpperCase() : null;
            if (word && /^[A-Z]+$/.test(word)) return word;
        } catch (error) { console.error("Fallback API fetch failed:", error); }

        console.error("Ultimate fallback: Using predefined word for difficulty: " + currentDifficulty);
        const fallbacks = {
            "easy": ["CAT", "SUN", "DOG", "RUN", "FLY"],
            "moderate": ["PLANET", "ORANGE", "ACTIVE", "SILVER", "PYTHON"],
            "hard": ["CHAMPION", "KEYBOARD", "LANGUAGE", "WONDERFUL", "MYSTERY"]
        };
        const set = fallbacks[currentDifficulty] || fallbacks["moderate"];
        return set[Math.floor(Math.random() * set.length)];
    }
    
    async function initializeGame() {
        disableKeyboardTemporarily(true);
        wordDisplay.innerHTML = '<p class="loading-text">Fetching a new word...</p>';
        keyboardContainer.innerHTML = '';
        wordOptionsModal.style.display = 'none'; // Ensure options modal is hidden

        difficultyRadios.forEach(radio => {
            radio.checked = radio.value === currentDifficulty;
        });

        setMaxHints();
        setMaxOptionsUses(); // Set uses for options feature
        decoyWords = []; // Clear previous decoys

        selectedWord = await fetchRandomWord();

        guessedLetters = [];
        incorrectGuesses = 0;

        wordDisplay.innerHTML = '';
        if (selectedWord) {
            selectedWord.split('').forEach(() => {
                const letterCard = document.createElement('div');
                letterCard.classList.add('letter-card');
                letterCard.textContent = '_';
                wordDisplay.appendChild(letterCard);
            });
        } else {
            wordDisplay.innerHTML = '<p class="loading-text" style="color:red;">Error loading word. Please Reset.</p>';
        }

        guessesLeftDisplay.textContent = maxIncorrectGuesses;
        resetHangman();
        createKeyboard();
        updateHintButtonUI();
        updateOptionsButtonUI(); // Update options button UI
        gameOverModal.style.display = 'none';
        gameContainer.classList.remove('grayscale-fade');
        stopConfetti();
        disableKeyboardTemporarily(false);
    }

    // Function to generate and display word options
    async function showWordOptions() {
        if (optionsUsesRemaining <= 0 || !selectedWord || wordOptionsModal.style.display === 'flex') return;

        if (optionUsedSound) optionUsedSound.play().catch(e => console.error("Error playing option sound:", e));
        
        wordOptionsDisplay.innerHTML = ''; // Clear previous options
        wordOptionsLoadingText.style.display = 'block';
        wordOptionsModal.style.display = 'flex';
        disableKeyboardTemporarily(true); // Disable game controls while options are shown

        const currentDecoys = [];
        const excludeList = [selectedWord];

        // Fetch first decoy
        let decoy1 = await fetchSingleWordWithFallback(selectedWord.length, excludeList);
        if (decoy1) excludeList.push(decoy1); else decoy1 = "DECOYONE"; // Fallback decoy name

        // Fetch second decoy
        let decoy2 = await fetchSingleWordWithFallback(selectedWord.length, excludeList);
        if (!decoy2) decoy2 = "DECOYTWO"; // Fallback decoy name
        
        currentDecoys.push(decoy1, decoy2);

        const options = [selectedWord, ...currentDecoys];
        // Shuffle options: Fisher-Yates shuffle
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        
        wordOptionsLoadingText.style.display = 'none';

        options.forEach(word => {
            const optionButton = document.createElement('button');
            optionButton.classList.add('word-option-button');
            optionButton.textContent = word;
            optionButton.addEventListener('click', () => handleOptionSelected(word));
            wordOptionsDisplay.appendChild(optionButton);
        });

        optionsUsesRemaining--;
        updateOptionsButtonUI(); // Update after use
        // No need to call disableKeyboardTemporarily(false) here yet, wait for selection or cancel
    }

    // Handle when a player selects a word option
    function handleOptionSelected(chosenWord) {
        wordOptionsModal.style.display = 'none';
        disableKeyboardTemporarily(false); // Re-enable game controls

        if (chosenWord === selectedWord) {
            if (winSound) winSound.play().catch(e => console.error("Error playing win sound:", e));
            // Fill guessedLetters with all letters of selectedWord
            guessedLetters = selectedWord.split('');
            updateWordDisplay(); // This will now reveal the whole word
            checkWinCondition(); // This should now register a win
        } else {
            if (incorrectSound) incorrectSound.play().catch(e => console.error("Error playing incorrect sound:", e));
            incorrectGuesses++;
            guessesLeftDisplay.textContent = maxIncorrectGuesses - incorrectGuesses;
            updateHangmanDrawing();
            checkLoseCondition();
            // The option button is already disabled or count reduced from showWordOptions
        }
        updateHintButtonUI(); // Game state changed
        updateOptionsButtonUI(); // Game state changed
    }


    function resetHangman() {
        // ... (existing resetHangman function)
        hangmanParts.forEach(part => {
            part.classList.remove('visible');
            part.style.opacity = '0';
            part.style.transform = 'scale(0.5)';
        });
    }

    function createKeyboard() {
        // ... (existing createKeyboard function)
        keyboardContainer.innerHTML = '';
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        letters.split('').forEach(letter => {
            const button = document.createElement('button');
            button.classList.add('key-button');
            button.textContent = letter;
            button.addEventListener('click', () => handleGuess(letter, button));
            keyboardContainer.appendChild(button);
        });
    }

    function handleGuess(letter, buttonElement) {
        // ... (existing handleGuess function)
        if (guessedLetters.includes(letter) || incorrectGuesses >= maxIncorrectGuesses || !selectedWord) {
            return;
        }
        guessedLetters.push(letter);
        buttonElement.disabled = true;

        if (selectedWord.includes(letter)) {
            if (correctSound) correctSound.play().catch(e => console.error("Error playing correct sound:", e));
            buttonElement.classList.add('correct');
            updateWordDisplay();
            checkWinCondition();
        } else {
            if (incorrectSound) incorrectSound.play().catch(e => console.error("Error playing incorrect sound:", e));
            buttonElement.classList.add('incorrect');
            incorrectGuesses++;
            guessesLeftDisplay.textContent = maxIncorrectGuesses - incorrectGuesses;
            updateHangmanDrawing();
            checkLoseCondition();
        }
        // Update hint/options button availability after each guess
        updateHintButtonUI();
        updateOptionsButtonUI();
    }

    function updateWordDisplay() {
        // ... (existing updateWordDisplay function)
        if (!selectedWord) return;
        const letterCards = wordDisplay.children;
        selectedWord.split('').forEach((char, index) => {
            if (letterCards[index] && guessedLetters.includes(char)) {
                if (letterCards[index].textContent === '_') {
                    letterCards[index].textContent = char;
                    letterCards[index].classList.add('revealed');
                }
            }
        });
    }

    function updateHangmanDrawing() {
        // ... (existing updateHangmanDrawing function)
        if (incorrectGuesses > 0 && incorrectGuesses <= hangmanParts.length) {
            const partToShow = document.getElementById(getHangmanPartId(incorrectGuesses));
            if (partToShow) {
                partToShow.classList.add('visible');
            }
        }
    }
    
    function getHangmanPartId(guessCount) {
        // ... (existing getHangmanPartId function)
        const partsOrder = ['head', 'body', 'left-arm', 'right-arm', 'left-leg', 'right-leg'];
        return partsOrder[guessCount - 1];
    }

    function checkWinCondition() {
        if (!selectedWord) return;
        const allLettersGuessed = selectedWord.split('').every(char => guessedLetters.includes(char));
        if (allLettersGuessed) {
            if (winSound) winSound.play().catch(e => console.error("Error playing win sound:", e));
            gameOverMessage.textContent = '🎉 You Win! 🎉';
            correctWordDisplay.textContent = `The word was: ${selectedWord}`;
            gameOverModal.style.display = 'flex';
            disableKeyboard();
            startConfetti();
            updateHintButtonUI(); // Disable on game over
            updateOptionsButtonUI(); // Disable on game over
        }
    }

    function checkLoseCondition() {
        if (incorrectGuesses >= maxIncorrectGuesses) {
            if (loseSound) loseSound.play().catch(e => console.error("Error playing lose sound:", e));
            gameOverMessage.textContent = '😭 You Lost 😭';
            correctWordDisplay.textContent = `The word was: ${selectedWord}`;
            gameOverModal.style.display = 'flex';
            gameContainer.classList.add('grayscale-fade');
            revealFullWord();
            disableKeyboard();
            updateHintButtonUI(); // Disable on game over
            updateOptionsButtonUI(); // Disable on game over
        }
    }

    function revealFullWord() {
        // ... (existing revealFullWord function)
         if (!selectedWord) return;
        const letterCards = wordDisplay.children;
        selectedWord.split('').forEach((char, index) => {
            if (letterCards[index] && letterCards[index].textContent === '_') {
                letterCards[index].textContent = char;
                letterCards[index].classList.add('revealed');
            }
        });
    }

    function disableKeyboard() {
        // ... (existing disableKeyboard function)
        const buttons = keyboardContainer.querySelectorAll('.key-button');
        buttons.forEach(button => button.disabled = true);
    }

    function disableKeyboardTemporarily(disable) {
        resetButton.disabled = disable;
        playAgainButton.disabled = disable; // Though this is in modal, good practice
        difficultyRadios.forEach(radio => radio.disabled = disable);

        if (hintButton) {
            if (disable) hintButton.disabled = true;
            else updateHintButtonUI();
        }
        if (optionsButton) { // Also manage the options button state
            if (disable && wordOptionsModal.style.display !== 'flex') optionsButton.disabled = true; // Don't disable if options modal itself is active
            else updateOptionsButtonUI();
        }

        const keyButtons = keyboardContainer.querySelectorAll('.key-button');
        keyButtons.forEach(btn => btn.disabled = disable);
    }

    function startConfetti() {
        // ... (existing startConfetti function)
        confettiContainer.innerHTML = '';
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.classList.add(`c${Math.ceil(Math.random() * 5)}`);
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confettiContainer.appendChild(confetti);
        }
    }

    function stopConfetti() {
        // ... (existing stopConfetti function)
        confettiContainer.innerHTML = '';
    }

    // Initial game setup
    difficultyRadios.forEach(radio => {
        if (radio.value === currentDifficulty) {
            radio.checked = true;
        }
    });
    initializeGame();
});