import http from "http";
import os from "os";

// simple script to generate 1000 product
const product = (item = 1000) => {
	let p = [];
	for (let i = 0; i < item; i++) {
		p.push({
			id: i + 1,
			name: `Product ${i + 1}`,
			price: 100 + (i % 50),
			category: ["A", "B", "C", "D"][i % 4],
		});
	}
	return p;
};
const send = (res, code, body) => {
	res.writeHead(code, { "content-Type": "application/json" });
	res.end(JSON.stringify(body));
};
const sleep = (ms = 50) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {}
};
http
	.createServer((req, res) => {
		if (req.url == "/health") return send(res, 200, { status: "ok" });
		if (req.url == "/products") {
			return send(res, 200, { host: os.hostname(), items: product() });
		}
		if (req.url == "/work") {
			sleep();
			return send(res, 200, { host: os.hostname() });
		}
	})
	.listen(8000, () => {
		console.log("server running on 8000");
	});
