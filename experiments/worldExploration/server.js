var express = require('express')
var app = express()
var moment = require('moment')

//pull parameters from config.js (TODO update to .json)
var fs = require('fs')
var vm = require('vm')
vm.runInThisContext(fs.readFileSync(__dirname + '/config.js'))

var use_db = configs.use_db
var time_to_play = configs.play_time
var experiments_posted = 0

//server side information about 
var turkers = {}

//comprehension tasks
var global_comp_tasks = ['all', 'fruits', 'animals', 'aquatics', 'apple', 'cow', 'fish']
//supplementary information from past subjects - currently hard coded in TODO: can be stored in a DB instead fairly easily
var supplements = ["Collect as many rocks as you can. Throw them at the other objects to generate a 3rd object.", "Definitely throw the rocks.", "Look for the rocks and avoid everything else because they prevent you from moving.", "Trees and pools don't allow you to interact"]
//the idea here would be to have some sort of a way to be able to look up available results from previous generations by generation number
//in this way, someone would log on to the experiment, and do one of two things
//	* if the number of chains started so far is less than the number desired, start a new chain and put this turker on generation 1
//	* else, have them latch on to the "shortest" existing chain by taking the results from the smallest generation number currently available
//i'd probably implement this with a list of lists, where the sublist at index i contains results from that generation. 
//then, each new turker iterates through the list and pulls from the first sublist with info


var conditionAssignments = {}

//build https server if certs installed, else use http
try {
	var https = require('https')
	var port = configs.https_port
	var privateKey = fs.readFileSync(configs.private_key)
	var certificate = fs.readFileSync(configs.certificate)
	var credentials = {key: privateKey, cert: certificate}
	var server = https.createServer(credentials, app)
	var io = require('socket.io').listen(server)
} catch(err){
	console.log("HTTPS failed to launch -- falling back to HTTP")
	var http = require('http')
	var port = configs.http_port
	var server = http.createServer(app)
	var io = require('socket.io').listen(server)
}

//params for mysql connection (similar to robert's setup)
if(use_db){
	var mysql = require('mysql')
	var database = require(__dirname + '/js/database')
	var connection = mysql.createConnection({
		host		: 'localhost',
		user		: 'root',
		password	: 'cocolab',
		database	: 'test'
	})
}

//tell express to serve everything asked for within this dir
app.use(express.static(__dirname));
app.get(/^(.+)$/, function(req, res){ 
     console.log('static file request : ' + req.params);
     console.log("ACCESS: " + req.params[0])
     res.sendFile(__dirname + req.params[0])
 });

//useful function for generating timestamps for data
var getTimestamp = function(){
	var date = moment().format().slice(0, 10)
	var time = moment().format().slice(11, 19)
	return date + ' ' + time
}

//socket.io allows for namespaces which handle connections seperately
//each page in the experiment has a different namespace handling its function

//namespace for assigning experiment parameters/conditions - first page in series
var expnsp = io.of('/experiment-nsp')
expnsp.on('connection', function(socket){

	socket.on('request', function(workerPacket){

		//this is the point where we'd iterate through the data structure holding information produced by past generations
		//and find the smallest chain that this turker can latch on to

		var workerId = workerPacket.workerId;
		//these are hard coded variables for condition balancing - interpreted on client end
		var condition = (experiments_posted % 2 == 0) ? 'a' : 'b';
		var question_order = (experiments_posted < 6) ? 'q1' : 'q2';
		var supplement = supplements[0];

		//how information about the turkers is stored server side - TODO implement with a DB so the server can survive resets
		turkers[workerId] = {
			task: 'new',
			comp_actions: [],
			responses: [],
			comp_tasks: global_comp_tasks.sort(function(){return 0.5-Math.random()}),
			supplement: supplement,
			condition: condition,
			questionOrder: question_order,
			experimenterNumber: experiments_posted,
			score: 0
		}
		//make sure first and last comprehension tasks are "new" and "done" (keeping track of progress on client side)
		turkers[workerId].comp_tasks.splice(0, 0, "new")
		turkers[workerId].comp_tasks.splice(turkers[workerId].comp_tasks.length, 0, "done")
		global_comp_tasks = ['all', 'fruits', 'animals', 'aquatics', 'apple', 'cow', 'fish']

		fs.writeFile('results/' + workerId + '-comprehension.txt', 'Comprehension Summary\n', function(err){
			if(err){
				console.log(err)
			}
		})
		
		//server counts number of experiments posted for condition balancing
		experiments_posted += 1
		//send information to the client about this experiment
		socket.emit('condition', {condition: condition, question_order: question_order, supplement: supplement})

		console.log('condition sent')
	})

})

//namespace for quality assurance namespace (comprehension tasks)
var qagamensp = io.of('/qagame-nsp')
qagamensp.on('connection', function(socket){

	socket.on('request', function(data_packet){
		var workerId = data_packet.workerId
		var old_task = turkers[workerId].task
		var next_task = turkers[workerId].comp_tasks[turkers[workerId].comp_tasks.indexOf(old_task) + 1]
		turkers[workerId].task = next_task
		turkers[workerId].comp_actions.push({task: next_task, actions: []})

		if(next_task == 'done'){
			var to_write = ''
			for(var i = 0; i < turkers[workerId].comp_actions.length; i++){
				var to_write = ''
				var comp_actions_set = turkers[workerId].comp_actions[i]
				for(var j = 0; j < comp_actions_set.actions.length; j++){
					to_write += 'task: ' + comp_actions_set.task + ' - action: ' + comp_actions_set.actions[j] + '\n'
				}
				console.log(to_write)
			}

			socket.emit('redirect', '/thanks.html')
		}else{
			socket.emit('task', next_task)
		}
	})

	socket.on('action', function(action_packet){
		var workerId = action_packet.workerId
		var action_done = action_packet.action
		turkers[workerId].comp_actions[turkers[workerId].comp_actions.length - 1].actions.push(action_done)
		fs.appendFile('results/' + workerId + '-comprehension.txt', 'task: ' + turkers[workerId].task + ', action: ' + action_done + '\n', function(err){
			if(err){
				console.log(err)
			}
		})
		console.log('comp actions: ');
		console.log(turkers[workerId].comp_actions)
	})

})

//survey namespace retrieves questions answered after the experiment is over (including data for the next generation)
var surveynsp = io.of('/survey-nsp')
surveynsp.on('connection', function(socket){

	socket.on('response', function(response_packet){
		var workerId = response_packet.workerId
		var response_packet = {question:response_packet.question, response: response_packet.response}
		turkers[workerId].responses.push(response_packet)
		//this would be the point at which we add to the data structure tracking responses from generations for new turkers
	})

	socket.on('request', function(request_packet){
		var workerId = request_packet.workerId;
		console.log('request for: ' + turkers[workerId]);
		console.log('comp: ' + turkers[workerId].comprehension);
		// console.log('request from ' + workerId + ', sending: ' + turkers[workerId].responses)
		socket.emit('responses', {responses: turkers[workerId].responses, supplement: turkers[workerId].supplement, comprehension: turkers[workerId].comp_actions, score: turkers[workerId].score})
	})

})

//actual meat of the game
var gamensp = io.of('/game-nsp')
gamensp.on('connection', function(socket){
	
	var hs = socket.handshake
	var query = require('url').parse(socket.handshake.headers.referer, true).query
	var condition = (query.condition) ? query.condition : 'a'
	var workerId = (query.workerId) ? query.workerId : 'undefinedID'

	var score = 0

	var plus_score_actions = ['get cow', 'get chicken', 'get pig', 'get apple', 'get grape', 'get lemon', 'get fish', 'get whale', 'get crab']
	var minus_score_actions = ['shoot cow', 'shoot chicken', 'shoot pig', 'shoot apple', 'shoot grape', 'shoot lemon', 'shoot fish', 'shoot whale', 'shoot crab']
	
	var discovered = []
	var time_points = []

	console.log("Connection from workerId: " + workerId + ".")

	var timer = function(seconds){
		setTimeout(function(){
			if (seconds >= 1){
				socket.emit('timer', seconds - 1)
				timer(seconds - 1)
			} else {
				//redirect
				var destination = '/survey.html'
				socket.emit('redirect', destination)
				console.log("Redirecting " + workerId + ".")

				//log all results in discoveries file and scores file
				discovery_string = 'summary of discoveries\n'
				for (var i = 0; i < discovered.length; i++){
					discovery_string += discovered[i] + '\n'
				}
				fs.writeFile('results/' + workerId + '-discoveries.txt', discovery_string, function(err){
					if(err){
						console.log(err)
					}
				})

				score_string = '"time","points"\n'
				for (var i = 0; i < time_points.length; i++){
					score_string += '"' + time_points[i].time + '","' + time_points[i].score + '"\n'
				}
				fs.writeFile('results/' + workerId + '-scores.csv', score_string, function(err){
					if(err){
						console.log(err)
					}
				})

			}
		}, 1000)
	}

	timer(time_to_play)

	if(use_db){
		database.addPlayer(workerId, condition)
	}

	var first_line = '"' + getTimestamp() + '","connected"\n'
	fs.writeFile('results/' + workerId + '.csv', first_line, function(err){
		if(err){
			console.log(err)
		}
	})

	var updateCSV = function(action){
		var to_append = '"' + getTimestamp() + '","' + action + '"\n'
		fs.appendFile('results/' + workerId + '.csv', to_append, function(err){
			if(err){
				console.log(err)
			}
		})
	}

	var updateDB = function(action){
		database.updatePlayer(workerId, condition, action, score)
	}

	socket.on('action', function(action){
		console.log(action)
		if(discovered.indexOf(action) == -1){
			discovered.push(action)
		}
		if(plus_score_actions.indexOf(action) >= 0){
			score += 1
			time_points.push({time:getTimestamp(), score:score})
			turkers[workerId].score = score;
		}else if(minus_score_actions.indexOf(action) >= 0){
			score -= 1
			time_points.push({time:getTimestamp(), score:score})
			turkers[workerId].score = score;
		}
		updateCSV(action)
		if(use_db){
			updateDB(action)
		}
	});
})

server.listen(port, function(){
	console.log("Game server listening port " + port + ".")
	if(use_db){
		console.log("Logging in mysql database.")
	}
})
