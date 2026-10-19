import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
	vus: 3000,
	duration: "2m",
};

export default function () {
	let res = http.get("http://localhost:8000/products");
	check(res, { "status is 200": (res) => res.status === 200 });
	sleep(1);
}
