Crafty.c("Enemy", {
	BALLOON_DURATION: 128,
	init: function() {
		console.log("Enemy : init");
		_.bindAll(this);
		this.addComponent("2D, DOM, Color, Collision, Text, Tweet, SpriteAnimation, Party, balloonx2");
		this.color("#0F0");
		this.w = 120;
		this.h = 120;
		this.selected = false;
		this.hit = false;
		this.y = Crafty.DOM.window.height + this.h;
		this.x = this.w + Math.random()*(Crafty.DOM.window.width-this.w*2);
		// this.x = Crafty.DOM.window.width-150;
		this.dy = (Math.random()*.5)+.3; // speed
		this.scoreMultiplier = 1;
		
		this.TERMINAL_VELOCITY = 10; // for falling, max dy
		
		this
			.animate("hit_d", 0, 3, 4)		
			.animate("hit_r", 5, 3, 9)		
			.animate("falling_d", 0, 0, 1)		
			.animate("falling_r", 2, 0, 3)		
			.animate("normal", 0, 2, 15)		
			.animate("normal", this.BALLOON_DURATION, -1)			


		this.collision(new Crafty.polygon([
			[20,40],
			[this.w/4,10],
			[this.w/2, 0],
			[3*(this.w/4),10],
			[this.w-20,40],
			[this.w/2, this.h],
		]));
		
		this.startMovement();
		
	},
	
	/**
	 * This is called from within the dart's hit event handler.  Must be registered after hit so that only 
	 * balloons that have been hit will be subscribed to the hit complete event.
	 */
	registerHitCompleteEvent: function() {
		HA.m.subscribe(HA.e.ENEMY_HIT_COMPLETE, this._handleHitCompleteEvent);		
	},
	
	unbindAllMediatorEvents: function() {
		HA.m.unsubscribe(HA.e.ENEMY_HIT_COMPLETE, this._handleHitCompleteEvent);
		HA.m.unsubscribe(HA.e.ENEMY_OFF_SCREEN_COMPLETE, this._handleEnemyOffScreenComplete);		
	},
	
	_handleHitCompleteEvent: function(e, enemy, dScore) {
		this.doHit(dScore);
	},
	
	_handleEnemyOffScreenComplete: function(e, enemy, dScore, whoops) {
		console.log("Enemy: _handleEnemyOffScreenComplete", enemy, dScore);
		if(whoops) {
			this.showScore(dScore, 0);
		}
		this.unbindAllMediatorEvents();
		this.destroy();
	},
	
	/**
	 * This is called from the hit complete event handler
	 */
	doHit: function(dScore) {
		if(this.hit) return;
		this.hit = true;
		this
			.animate("hit_"+this.getParty(), 30, 0)
			.startFalling();
		if(typeof this.selection !== 'undefined') this.selection.destroy();
		this.showTweetPerson();
		this.showScore(dScore);
			
	},
	
	setSpeed: function(speed) {
		console.log("speed: ", speed);
		this.dy = (speed); // speed
		console.log("this.dy: ", this.dy);
		return this;
	},
	startMovement: function() {
		this.bind("EnterFrame", this._risingCallback);
	},
	startFalling: function() {
		console.log("falling");
		this
			.unbind("EnterFrame", this._risingCallback)
			.bind("EnterFrame", this._fallingCallback);
	},
	_fallingCallback: function(e) {
		// added test for isPlaying, otherwise this was causing errors on re-init
		if(typeof this.isPlaying === 'function' && !this.isPlaying('hit_r') && !this.isPlaying('hit_d')) {
			this.animate("falling_"+this.getParty(), 10, -1);
		}
		this.y += this.dy;
		if(this.dy < this.TERMINAL_VELOCITY) {
			this.dy = this.dy*1.1;
		}
		if(this.y > Crafty.DOM.window.height+20) {
			this.unbindAllMediatorEvents();
			this
				.unbind("EnterFrame", this._fallingCallback)
				.destroy();
			console.log("++++++ DESTROYED ENEMY ENTITY", this, this.y);
		}
	},
	_risingCallback: function(e) {
			this.y -= this.dy;
			if (this.y < 80-this.h-10) {
				console.log("enemy off screen");
				if(this.hit) return;
				this.hit = true;
				this.unbind("EnterFrame");
				
				HA.m.subscribe(HA.e.ENEMY_OFF_SCREEN_COMPLETE, this._handleEnemyOffScreenComplete);
				
				HA.m.publish(HA.e.ENEMY_OFF_SCREEN_START, [this]);
			}
	},
	showScore: function(score, offset) {
		if(!_.isNumber(offset)) offset = -40;
		// console.log("******** showScore");
		var hit_score = Crafty.e("HitScore")
							.attr({
								x: this.x,
								y: this.y+offset
							})
							.setScore(score);							
	},
	showTweetPerson: function() {
		var party = this.getParty();
		var tweet_person = Crafty.e('TweetPerson')
				.attr({
					x: this.x+20,
					y: this.y+70
				})
				.setTweetPersonParty(party);
		var yv = tweet_person.yv;
		var tweet_person_info = Crafty.e("TweetPersonInfo")
				.attr({
					tweet: this.tweet,
					parent_x: this.x,
					parent_y: this.y,
					parent_w: this.w,
					yv: yv
				})
				.setParty(party)
				.drawInfo();
		// var tpw = tweet_person_info.;
	},
	select: function() {
		if(!this.selected) Crafty.audio.play("select", 1, .5);
		this.selected = true;
		this.selection = Crafty.e('EnemySelection')
						.attr({
							x:this.x,
							y:this.y,
							enemyParent: this
						});
		this.balloon_select_arrow = Crafty.e('EnemySelectionArrow')
						.attr({
						  x:this.x+((this.w/2)-30),
              y:this.y-70,
              enemyParent: this
            });

		// this.stop().animate("selected", this.BALLOON_DURATION, -1);
		HA.m.publish(HA.e.ENEMY_SELECTED, [this]);
	},
	unselect: function() {
		this.selected = false;
		if(typeof this.selection !== 'undefined') this.selection.destroy();			
		if(typeof this.balloon_select_arrow !== 'undefined') this.balloon_select_arrow.destroy();			
		// this.stop().animate("normal", this.BALLOON_DURATION, -1);
	}
});
