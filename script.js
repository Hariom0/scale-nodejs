import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
	stages : [
		{duration:"30s",target:100},
		{duration:"30s",target:300},
		{duration:"30s",target:500},
		{duration:"30s",target:1200},
		{duration:"30s",target:0},
	]
};

export default function () {
	let res = http.get("http://localhost:8000/products");
	check(res, { "status is 200": (res) => res.status === 200 });
	sleep(1);
}
