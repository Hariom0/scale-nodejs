module.exports  = {
	apps: [
		{
			name: "scale-app",
			script: "app.js",
			instances: process.env.PM2_WORKERS ? Number(process.env.PM2_WORKERS) : 2,
			exec_mode: "cluster", 
		},
	],
};
