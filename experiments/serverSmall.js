var express = require('express'),
 		app = express(),
 		fs = require('fs'),
 		vm = require('vm'),
 		moment = require('moment');

vm.runInThisContext(fs.readFileSync(__dirname + '/config.js'))
// var use_db = configs.use_db
var time_to_play = configs.play_time
var exit_survey_url = configs.exit_survey_url

// var nChains = config.nChains; // number of chains
// var nGenPerChain = config.nGenPerChain; // number of gens in a chain
// var bigN = nChains * nGenPerChain;

//hard code in the above
var nChains = 2
var nGenPerChain = 4
var bigN = nChains * nGenPerChain

var getTimestamp = function(){
	var date = moment().format().slice(0, 10)
	var time = moment().format().slice(11, 19)
	return date + ' ' + time
}

try {
	var
		 https = require('https'),
		 port = configs.https_port,
		 privateKey = fs.readFileSync(configs.private_key),
		 certificate = fs.readFileSync(configs.certificate),
		 credentials = {key: privateKey, cert: certificate},
		 server = https.createServer(credentials, app),
		 io = require('socket.io').listen(server);
} catch(err){
	console.log("HTTPS failed to launch -- falling back to HTTP")
	var
		 http = require('http'),
		 port = configs.http_port,
		 server = http.createServer(app),
		 io = require('socket.io').listen(server)
}

var mongodb = require('mongodb')
var MongoClient = mongodb.MongoClient
var url = 'mongodb://superAdmin:admin123@localhost:27017/test?authSource=admin';
var db
MongoClient.connect(url, function(err, database){
	if(err){
		console.log("Error connecting to mongoDB server: ", err)
	}else{
		console.log("Connection established to", url)
		db = database
		main(db)
	}
})	

var main = function(db){
	app.listen(3000)
	console.log("listening on port 3000")
	var chain_collection = db.collection('chains')
	var data_collection = db.collection('data')
	var language_collection = db.collection('language')
	
	app.use(express.static(__dirname));

	app.get(/^(.+)$/, function(req, res){
	     console.log('static file request : ' + req.params);
	     console.log("ACCESS: " + req.params[0])
	     res.sendFile(__dirname + req.params[0])
	 });

	var fnnsp = io.of('/function-nsp')
	//the plan...
	//we are running only two chains right now - one for language, one for data.
	//on connection, we assign to language or data_incidental chain
	//then, depending on the chain we send relevant information
	//	* NB if they're the first generation, we send nothing (this is docs.length == 0 || docs.length == 1 below)
	//we receive data, and store as normal (below as socket.on('data', function(trial_data){}))
	//we don't have to worry about anyone waiting because the HITs are posted 2 at a time --> always an opening

	fnnsp.on('connection', function(socket){
		socket.emit('workerID request')
		socket.on('workerID', function(workerID){
			chain_collection.find({'genInProgress': false, 'chainInProgress': true}).sort({'gen':1}).limit(1).toArray(function(err, docs){
				if(docs.length == 0){
					var condition = 'language'
					var new_chain = {
						gen: 1,
						chain: 1,
						genInProgress: true,
						chainInProgress: true,
						workerID: workerID,
						condition: condition
					}
					chain_collection.insertOne(new_chain, function(err, res){
						if(err){
							console.log('err', err)
						}else{
							socket.emit('assignmeent', {condition: condition, data: []})
						}
					})
				}else if(docs.length == 1){
					var condition = 'data_incidental'
					var new_chain = {
						gen: 1,
						chain: 2,
						genInProgress: true,
						chainInProgress: true,
						workerID: workerID,
						condition: condition
					}
					chain_collection.insertOne(new_chain, function(err, res){
						if(err){
							console.log('err', err)
						}else{
							socket.emit('assignmeent', {condition: condition, data: []})
						}
					})
				}else{
					var minGen = docs[0]
					var condition = minGen.condition //we use this later to send data
					var new_chain = {
						gen: minGen.gen + 1,
						chain: minGen.chain,
						genInProgress: true,
						chainInProgress: minGen.chainInProgress,
						workerID: workerID,
						condition: condition
					}
					//insert the new chain, delete the old one
					chain_collection.insertOne(new_chain, function(err, res){
						if(err){
							console.log("err", err)
						}else{
							console.log('inserted new chain into chains')
							if(condition == 'language'){
								language_collection.find({gen: minGen.gen, chain: minGen.chain}, function(err, cursor){
									if(err){
										console.log("error querying language", err)
									}else{
										cursor.toArray(function(err, results){
											assert.equL(1, results.length)
											socket.emit('assignment', {condition: condition, data: results[0].message})
											deleteMinGen(minGen)
										})
									}
								})
							}else{
								data_collection.find({gen: minGen.gen, chain: chain}, function(err, cursor){
									if(err){
										console.log("error querying data", err)
									}else{
										cursor.toArray(function(err, results){
											socket.emit('assignment', {condition: condition, data: results})
											deleteMinGen(minGen)
										})
									}
								})
							}
							//delete the old one
							var deleteMinGen = function(minGen){
								chain_collection.deleteOne(minGen, function(err, res){
									if(err){
										console.log("err", err)
									}else{
										console.log('deleted old chain')
									}
								})
							}

						}
					})
				}
			})	
		})

		socket.on('data', function(trial_data){
			//get gen and chain info etc
			var trial = trial_data.trial
			var stimulus = trial_data.stimulus
			var response = trial_data.response
			var workerID = trial_data.workerID
			//we need condition, gen, chain
			chain_collection.find({workerID: workerID}, function(err, cursor){
				if(err){
					console.log("err", err)
				}else{
					cursor.toArray(function(err, results){
						if(err){
							console.log("err", err)
						}else{
							var doc = results[0]
							var condition = doc.condition
							var gen = doc.gen
							var chain = doc.chain
							var new_data_doc = {
								gen: gen,
								chain: chain,
								trial: trial,
								stimulus: stimulus,
								response: response,
								workerID: workerID,
								condition: condition
							}
							data_collection.insertOne(new_data_doc, function(err, results){
								if(err){
									console.log("err", err)
								}
							})
						}
					})
				}
			})
		})
		//receive when a worker completes their experiment - we can set the genInProgress var for their chain to false
		socket.on('complete', function(workerID){
			chain_collection.update({workerID: workerID}, {$set: {genInProgress: false}}, function(err, numChanged){
				if(err){
					console.log("error updating chain collection doc", err)
				}else{
					console.log("Changed %d doc(s)...", numChanged)
				}
			})
		})
	})

}