/**
 * Dart component. Sets color based on player party.
 * @class dart
 */

Crafty.c("Dart", {
	_party: null,
	/**
	 Initialize dart component
	 @private
	 @method init
	 @param {Object} e Event object.
	 */
	init: function() {
		this.addComponent("2D, DOM, Color, Collision, Party");
		this.setPartySpriteTemplate('%p_dartx2');
		
		this.w = 40;
		this.h = 40;
		this.dy = 1;
		this.ay = .2;

		this.collision(new Crafty.polygon([
			[15, 10],
			[this.w-15, 10],
			[this.w-15, this.h-10],
			[15, this.h-10]
		]));
		
		/**
		 * Trigger the ENEMY_HIT event.
		 */
		this.onHit("Enemy", function(e) {
			var enemy = e[0].obj;
			if(enemy.y+enemy.h/3 < this.y) return;
			enemy.registerHitCompleteEvent();
			HA.m.publish(HA.e.ENEMY_HIT_START, [e[0].obj]);
			this.destroy();
		});
		
		
		
		this.bind("EnterFrame", function() {
			this.y += this.dy;
			this.dy = this.dy+this.ay;
		});
	},
	
	// setParty: function(party) {
	// 	if(party === 'r' || party === 'd' ) {
	// 		this._party = party;
	// 		this.addComponent(this._party+'_dartx2');
	// 	} else { throw "Party must be set to either 'd' or 'r'"; }
	// }
});