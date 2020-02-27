import { PubSub } from "../../client/pubSub";

const admin = () => {
	let pubSub = new PubSub();
	const testSubscriber1 = (topics, data) =>
		console.log("sub1" + ": " + topics + data);
	const testSubscriber2 = (topics, data) =>
		console.log("sub2" + ": " + topics + data);
	const testSubscriber3 = (topics, data) =>
		console.log("sub3" + ": " + topics + data);

	const testSubscription1 = pubSub.subscribe("example1", testSubscriber1);
	const testSubscription2 = pubSub.subscribe("example1", testSubscriber2);

	pubSub.publish("example1", "hello world!");
	pubSub.publish("example1", ["test", "a", "b", "c"]);
	pubSub.publish("example1", [{ color: "blue" }, { text: "hello" }]);

	pubSub.publish("example2", "goodby cruel world!");
	pubSub.publish("example2", ["test", "a", "b", "c"]);
	pubSub.publish("example2", [{ color: "blue" }, { text: "hello" }]);

	pubSub.publish("example1", "into the journey world!");
	pubSub.publish("example1", ["test", "a", "b", "c"]);
	pubSub.publish("example2", [{ color: "blue" }, { text: "hello" }]);

	setInterval(function() {
		const testSubscription3 = pubSub.subscribe("example2", testSubscriber3);
		pubSub.publish("example1", "into the journey world!");
		pubSub.publish("example1", ["test", "a", "b", "c"]);
		pubSub.publish("example2", [{ color: "blue" }, { text: "hello" }]);
		pubSub.unsubscribe(testSubscription1);
	}, 500);

	pubSub.publish("example1", "hello again!");
};

export { admin };
