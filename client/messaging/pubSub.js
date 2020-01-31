/**
 * PubSub is a singleton class that implements the Pub/Sub or Observer pattern
 * for decoupled communication
 * @class PubSub
 */
class PubSub {
	/**
	 * @constructor
	 */
	constructor() {
		if (PubSub.instance) return PubSub.instance; // Singleton pattern
		PubSub.instance = this;

		this.topics = {
			any: [] //  default topic 'any' keeps subscribers' callbacks
		};
		this.subId = -1;
	}

	/**
	 * Subscribe topic of interest with topic name and callback for deferred execution
	 * Returns tokens for un-subscription
	 */
	subscribe(topic, callback) {
		if (!this.topics[topic]) {
			this.topics[topic] = [];
		}
		let token = (++this.subId).toString();
		this.topics[topic].push({
			token: token,
			callback: callback
		});
		return token;
	}

	/**
	 * Unsubscribe from topic with token
	 */
	unsubscribe(token) {
		for (let topic in this.topics) {
			if (this.topics[topic]) {
				for (let i = 0, j = this.topics[topic].length; i < j; i++) {
					if (this.topics[topic][i].token === token) {
						this.topics[topic].splice(i, 1); // Remove 1 callback at index i
						return token;
					}
				}
			}
		}
		return this;
	}

	/**
	 * Publish to all subscribers
	 */
	publish(topic, data) {
		if (this.topics[topic]) {
			this.topics[topic].map(subscriber => subscriber.callback(data));
		}
		return this;
	}
}

export { PubSub };