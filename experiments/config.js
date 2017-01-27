var configs = {
	"nChains": 8, //half of chains go to language condition, half to data incidental condition
	"http_port": 80,
	"https_port": 443,
	"private_key": "sslcert/server.key",
	"certificate": "sslcert/server.crt",
	"mongo_url": 'mongodb://$username:$password@$address:$port/$dbname?authSource=$authenticationDatabase'
}
