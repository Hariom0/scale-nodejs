import express from "express";

const app = express();

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

app.get("/products", (req, res) => {
	return res.status(200).json({ product: product() });
});
app.get("/health",(req,res)=>{
	return res.status(200).json({"status":"ok"})
})
app.listen(8000, () => {
	console.log("server is running on port 8000");
});
