/**
 * Handles gameplay, including levels, game pause/unpause, and initializing other HA modules.
 * @class game
 */

HA.game = function(ns, $, _, C) {

	var _options = {},
			_defaults = {},
			_scoreIncrement = 100,
			_level = 0,
			_party,
			_perfectLevel = true,
			_numEnemiesPerLevel = 2,
			_partySelectMenu,
			_pauseDisplay,
			_state = 0;

	// private methods
	function _init(options) {
		options = options || {};
		_.extend(_options, _defaults, options);

		HA.player.init();
		HA.mediator.init();
		HA.enemyController.init();
		HA.sceneManager.init();
		
		$.ajaxSetup({
			beforeSend: function(xhr) {
				var token = _getCsrfToken();
				xhr.setRequestHeader('X-CSRF-Token', token);
			}
		});
		
		// TODO decide where twitter module needs to be initialized
		HA.twitter.init();

		// Set up initial event subscriptions
		HA.m.subscribe(HA.events.GAME_LOADED, _handleGameLoadedEvent);
		HA.m.subscribe(HA.events.START_NEW_GAME, _handleStartNewGameEvent);
		HA.m.subscribe(HA.events.GAME_OVER, _handleGameOverEvent);
		HA.m.subscribe(HA.events.PAUSE_GAME, _handlePauseGameEvent);
		HA.m.subscribe(HA.events.RESUME_GAME, _handleResumeGameEvent);
		HA.m.subscribe(HA.events.END_GAME, _handleEndGameEvent);
		HA.m.subscribe(HA.events.LEVEL_COMPLETE, _handleLevelCompleteEvent);
		HA.m.subscribe(HA.events.NEXT_LEVEL, _handleNextLevelEvent);
		
		// For window blur, when changing browser windows or application
		C.bind("Pause", function(e) {
			if(_state !== 1) return;
			C.audio.pause("game_music");
			HA.enemyController.stopProducing();
		});
		C.bind("Unpause", function(e) {
			if(_state !== 1) return;
			if(!C.isPaused()) return;
			C.audio.unpause("game_music");
			if(!HA.enemyController.isProducing()) HA.enemyController.startProducing();
		});
		
		HA.m.subscribe(HA.e.ENEMY_HIT_START, _handleEnemyHitStartEvent);
		HA.m.subscribe(HA.e.ENEMY_OFF_SCREEN_START, _handleEnemyOffScreenStartEvent);

		// Initialize Crafty
		C.init();
		C.settings.modify("autoPause", true);
		
		// Load the first scene
		HA.m.publish(HA.events.LOAD_SCENE, ["loading"]);

	};
	
	
	/***** EVENT HANDLERS *****/

	/**
	 * Handles GAME_LOADED event, after Crafty assets are loaded.
	 * @private
	 * @method _handleGameLoadedEvent
	 * @param {object} e
	 */
	function _handleGameLoadedEvent(e) {
		console.log("_handleGameLoaded");
		HA.sceneManager.loadScene("start");
	}

	/**
	 * Handles START_NEW_GAME event.
	 * @private
	 * @method _handleStartNewGameEvent
	 * @param {object} e
	 */
	function _handleStartNewGameEvent(e) {
		_setLevel(1);
		HA.player.setLives(3);
		_bindGameplayKeyboardEvents();
		_state = 1;
	}
	
	/**
	 * Handles GAME_OVER event.
	 * @private
	 * @method _handleGameOverEvent
	 * @param {object} e
	 */
	function _handleGameOverEvent(e) {
		console.log("HA.game handleGameoverEvent");
		// TODO: Possibly perform extra cleanup here, maybe clear out the mediator?
		_unbindGameplayKeyboardEvents();
		
		_saveScore();
		// _pauseDisplay.destroy();
		// _pauseMenu.destroy();
		HA.m.publish(HA.e.LOAD_SCENE, "gameover");
		_state = 2;
	}


	/**
	 Handle a PAUSE_GAME event.
	 @private
	 @method _handlePauseGameEvent
	 */
	function _handlePauseGameEvent(e) {
		console.log("Pause game!");
		if(!C.isPaused()) {
			// remove event bindings from Gameplay
			_unbindGameplayKeyboardEvents();
			
			// Create the pause display entity
			_pauseDisplay = C.e("PauseDisplay");
			
			// Create the pause nav entity
			_pauseMenu = C.e("ListNav")
				.attr({wrappingId: "PauseNav"});
			
			_pauseMenu.addListItem({
				text: "Resume",
				callback: function(arg) {
					console.log("Resume", this );
					HA.m.publish(HA.e.RESUME_GAME);
					this.destroy();
				}
			});
			
			_pauseMenu.addListItem({
				text: "End Game",
				callback: function(arg) {
					console.log("End Game...");
					HA.m.publish(HA.e.END_GAME);
				}
			});
			
			// Pause the music, but leave other sounds alone.
			C.audio.pause("game_music");
			C.audio.play('pause');
			
			// Do the actual frame pause on following frame.
			Crafty.bind("EnterFrame", _doPause);
			
		}
	};
	
	/**
	 * Perform the actual pause of the draw loop via Crafty.pause();
	 * Also displays the PauseDisplay and pause menu entities.
	 * @private
	 * @method _doPause(); 
	 */
	function _doPause() {
		_pauseDisplay.showPauseScreenDisplay();
		_pauseMenu.renderListNav();
		C.settings.modify("autoPause", false);
		C.pause();
	}

	/**
	 Handles the "resume game" selection from the pause screen.
	 @private
	 @method _handleResumeGame
	 @param {Object} e Event object.
	 */
	function _handleResumeGameEvent(e) {
		e.preventDefault();
		console.log("Resume game!");
		if(C.isPaused()) {
			C.audio.unpause("game_music");
			_pauseDisplay.destroy();
			_pauseMenu.destroy();
			Crafty.unbind("EnterFrame", _doPause);
			_bindGameplayKeyboardEvents();
			C.pause();
			C.audio.play('pause');
			C.settings.modify("autoPause", true);
		}
		return false;
	};

	/**
	 Handles the "end game" event from the pause screen.
	 @private
	 @method _handleEndGame
	 @param {Object} e Event object.
	 */
	function _handleEndGameEvent(e) {
		e.preventDefault();
		console.log("End game!");
		if(C.isPaused()) {
			_state = 0;
			_pauseDisplay.destroy();
			_pauseMenu.destroy();
			C.unbind("EnterFrame", _doPause);
			C.pause();
			C.audio.play('pause');
			HA.sceneManager.loadScene("start");
		}
		return false;
	};

	/**
	 Handle enemy hit start event.  Here is where we calculate the score/life updates.
	 @private
	 @method _handleEnemyHitStartEvent
	 @param {object} e Event object.
	 @param {object} enemy The related enemy entity.
	 */
	function _handleEnemyHitStartEvent(e, enemy) {
		if(enemy.hit) return;
		console.log("Enemy: ", enemy);
		console.log("Game: handleEnemyHitStart", enemy.tweet.party, HA.player.getParty());
		var scoreInc = _getScoreIncrement();
		if(enemy.tweet.party == HA.player.getParty()) {
			// _decrementScore();
			scoreInc = -scoreInc;
			HA.player.addToScore(scoreInc);
			C.audio.play('hit_bad');
			HA.player.decrementLives();
			_perfectLevel = false;
		} else {
			// _incrementScore();
			HA.player.addToScore(scoreInc);
			C.audio.play('hit_good');
		}
		HA.m.publish(HA.e.ENEMY_HIT_COMPLETE, [enemy, scoreInc]);
	};

	/**
	 Handle event when an enemy goes offscreen.
	 @private
	 @method _handleEnemyOffStartScreen
	 @param {Object} e Event object.
	 @param {object} enemy The related enemy entity.
	 */
	function _handleEnemyOffScreenStartEvent(e, enemy) {
		console.log("Game: handleEnemyOffScreenStart", enemy.hit);
		// if(enemy.hit) return;
		var scoreInc = _getScoreIncrement(), whoops = false;
		if(enemy.getParty() != HA.player.getParty()) {
			if(HA.player.getScore() > 0) {
				scoreInc = -scoreInc;
				HA.player.addToScore(scoreInc);
			} else {
				HA.player.decrementLives();
			}
			_perfectLevel = false;
			C.audio.play('hit_bad');
			whoops = true;
		}
		HA.m.publish(HA.e.ENEMY_OFF_SCREEN_COMPLETE, [enemy, scoreInc, whoops]);
	};
	
	/**
	 Handle level complete event.
	 @private
	 @method _handleLevelComplete
	 @param {Object} e Event object.
	 */
	_handleLevelCompleteEvent = function(e) {
		console.log("handleLevelComplete");
		if(_perfectLevel) {
			// perfect level, add a life!
			C.audio.play("addLife");
			HA.player.incrementLives();
			HA.m.publish(HA.e.SHOW_MESSAGE, ["Perfect Level!", function() { console.log("called back"); _incrementLevel(); }, this ]);
		} else {
			_incrementLevel();
		}
	};
	
	/**
	 Handle next level event.
	 @private
	 @method _handleNextLevelEvent
	 @param {Object} e Event object.
	 */
	function _handleNextLevelEvent(e) {
		console.log("handleNextLevel");
		C.audio.play("whoosh");
		var numEnemiesPerLevel = _getNumEnemiesPerLevel();
		var start = (_getLevel() - 1) * 2 * numEnemiesPerLevel;
		// _setIncrement(100 * _getScoreMultiplier());
		HA.enemyController.loadEnemySet(start, numEnemiesPerLevel);
		HA.enemyController.setSpeed(_getLevel() / 1.5);
		HA.enemyController.startProducing(true);
	};
	
	/**
	 * Bind the ENTER and ESC keys to the pause and full screen functionality.
	 * @private
	 * @method _bindGameplayKeyboardEvents
	 */
	function _bindGameplayKeyboardEvents() {
		_unbindGameplayKeyboardEvents();
		$(document).on("keydown", function(e) {
			if(e.keyCode == Crafty.keys['ENTER']) {
				if(!Crafty.isPaused()) {
					HA.m.publish(HA.events.PAUSE_GAME);
					_unbindGameplayKeyboardEvents();
				}
			}
			if(e.keyCode == Crafty.keys['ESC']) {
				console.log("Full scrn");
				if(screenfull) {
					screenfull.toggle();
				}
			}
		});
	}
	
	/**
	 * Unbind the ENTER and ESC keys to the pause and full screen functionality.
	 * @private
	 * @method _unbindGameplayKeyboardEvents
	 */
	function _unbindGameplayKeyboardEvents() {
		$(document).off("keydown");
	}
	
	/**
	 * Increment the level.
	 * @private
	 * @method _incrementLevel
	 */
	function _incrementLevel() {
		_level += 1;
		_perfectLevel = true;
		HA.m.publish(HA.e.NEXT_LEVEL, [_level]);
		HA.m.publish(HA.e.SHOW_MESSAGE, ["Level "+_level]);
		console.log("_incrementLevel", _level);
	}
	
	/**
	 * Set the game to a specific level directly.
	 * @private
	 * @method _setLevel
	 * @param {number} level The level to set the game to.
	 */
	function _setLevel(level) {
		_level = level;
		// Crafty.trigger("ShowMessage", {text: "Level "+e.level});
		HA.m.publish(HA.e.SHOW_MESSAGE, ["Level "+level]);
		// Crafty.trigger("SetLevel", {level: level});
	}
	
	function _getSpeed() {
		return _level;
	}
	
	function _getScoreMultiplier() {
		return _level;
	}
	
	function _getScoreIncrement() {
		return _level*_scoreIncrement;
	}
	
	function _getLevel() {
		return _level;
	}
	
	function _getNumEnemiesPerLevel() {
		return _numEnemiesPerLevel;
	}
	
	/**
	 Save score to high scores in database.
	 @private
	 @method _saveScore
	 */
	function _saveScore() {
		console.log("save score");
		var token = _getCsrfToken();
		$.ajax({
			url : "/highscore",
			type : "post",
			contentType : "application/json",
			data : JSON.stringify({
				user : "XXX",
				score : HA.player.getScore(),
				party : _party
			}),
			success : function(resp) {
				console.log("saved high score: ", resp);
			}
		});
	};
	
	/**
	 * Get the CSRF token from the meta tag.
	 * @private
	 * @method _getCsrfToken
	 * @return {string} The CSRF token.
	 */
	function _getCsrfToken() {
		var token = $("meta[name='csrf-token']").attr("content");
		return token;
	}
	// public methods

	/**
	 Initializer.
	 @public
	 @method init
	 */
	ns.init = _init;

	/**
	 Unpause gameplay.
	 @public
	 @method getParty
	 */
	ns.getParty = function() {
		return _party;
	};
	
	/**
	 UnPause gameplay.
	 @public
	 @method setParty
	 @param {String} p String representing party affiliation ('r' or 'd')
	 */
	ns.setParty = function(p) {
		if(p == 'r' || p == 'd') {
			_party = p;
		} else {
			throw "Party must be a string containing either 'r' or 'd'";
		}
	};
	return ns;

}(HA.namespace("HA.game"), jQuery, _, Crafty);
