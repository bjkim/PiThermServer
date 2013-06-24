// server.js - NodeJS server for the PiThermServer project.

/* 

Parses data from DS18B20 temperature sensor and serves as a JSON object.
Uses node-static module to serve a plot of current temperature (uses highcharts).

Tom Holderness 03/01/2013
Ref: www.cl.cam.ac.uk/freshers/raspberrypi/tutorials/temperature/
*/

'use strict';
// Load node modules
var fs = require('fs');
var sys = require('sys');
var http = require('http');
var sqlite3 = require('sqlite3');
var moment = require('moment');

var t4 = null; //'28-000003c2b108';
var t3 = null; //'28-00000427b9d6';
var t2 = '28-000003a7f65d';
var t1 = '28-000003a82057';

// Use node-static module to server chart for client-side dynamic graph
var nodestatic = require('node-static');

// Setup static server for current directory
var staticServer = new nodestatic.Server(".");

// Setup database connection for logging
var db1 = new sqlite3.Database('./piTemps1.db');
var db2 = new sqlite3.Database('./piTemps2.db');
var db3 = new sqlite3.Database('./piTemps3.db');
var db4 = new sqlite3.Database('./piTemps4.db');

// Write a single temperature record in JSON format to database table.
function insertTemp(index, data) {
  var db = null;
  if (index === 1) {
    db = db1;
  } else if (index === 2) {
    db = db2;
  } else if (index === 3) {
    db = db3;
  } else if (index === 4) {
    db = db4;
  }

  if (db) {
    // data is a javascript object   
    var statement = db.prepare("INSERT INTO temperature_records VALUES (?, ?)");
    // Insert values into prepared statement
    statement.run(data.temperature_record[0].unix_time, data.temperature_record[0].celsius);
    // Execute the statement
    statement.finalize();
  }
}

function insertTemp1(data) {
  insertTemp(1, data);
}
function insertTemp2(data) {
  insertTemp(2, data);
}
function insertTemp3(data) {
  insertTemp(3, data);
}
function insertTemp4(data) {
  insertTemp(4, data);
}

// Read current temperature from sensor
function readTemp(id, callback) {
  if (id == null) {
    return;
    // do not thing
  }

  fs.readFile('/sys/bus/w1/devices/' + id + '/w1_slave','utf8', function (err, buffer) {
    if (err) {
      console.error(err);
      if(id) {
        process.nextTick(function () {
          readTemp(id, callback);
        });
      }
      return; // process.exit(1);
    }
   
    var crc = buffer.match(/YES/g);
    if (!crc) {
      process.nextTick(function () {
        readTemp(id, callback);
      });
      return;
    }
    
    var temp = buffer.match(/t=(\-?\d+)/i);
    var cur_time = moment();
    cur_time.hours(cur_time.hour() + 9);

    // Add date/time to temperature
    var data = {
      temperature_record: [{
        unix_time: cur_time.valueOf(),
        celsius: temp[1]/1000 
      }]
    };

    // Execute call back with data
    callback(data);
  });
}

// Create a wrapper function which we'll use specifically for logging
function logTemp(interval) {
  // Call the readTemp function with the insertTemp function as output to get initial reading
  readTemp(t1, insertTemp1);
  readTemp(t2, insertTemp2);
  readTemp(t3, insertTemp3);
  readTemp(t4, insertTemp4);
  // Set the repeat interval (milliseconds). Third argument is passed as callback function to first (i.e. readTemp(insertTemp)).
  setInterval(function () {
    readTemp(t1, insertTemp1);
    readTemp(t2, insertTemp2);
    readTemp(t3, insertTemp3);
    readTemp(t4, insertTemp4);
  }, interval);
}

// Get temperature records from database
function selectTemp(index, num_records, start_date, callback) {
  var db = null;
  if (index === 1) {
    db = db1;
  } else if (index === 2) {
    db = db2;
  } else if (index === 3) {
    db = db3;
  } else if (index === 4) {
    db = db4;
  }


  // - Num records is an SQL filter from latest record back trough time series, 
  // - start_date is the first date in the time-series required, 
  // - callback is the output function
  var current_temp = db.all("SELECT * FROM (SELECT * FROM temperature_records WHERE unix_time > (strftime('%s',?)*1000) ORDER BY unix_time DESC LIMIT ?) ORDER BY unix_time;", start_date, num_records,
  function (err, rows) {
    if (err) {
      response.writeHead(500, { "Content-type": "text/html" });
      response.end(err + "\n");
      console.log('Error serving querying database. ' + err);
      return;
    }
    var data = {temperature_record: [rows]};
    callback(data);
  });
}
function selectTemp1(num_records, start_date, callback) {
  selectTemp(1, num_records, start_date, callback);
}
function selectTemp2(num_records, start_date, callback) {
  selectTemp(2, num_records, start_date, callback);
}
function selectTemp3(num_records, start_date, callback) {
  selectTemp(3, num_records, start_date, callback);
}
function selectTemp4(num_records, start_date, callback) {
  selectTemp(4, num_records, start_date, callback);
}

// Setup node http server
var server = http.createServer(
  // Our main server function
  function (request, response) {
		// Grab the URL requested by the client and parse any query options
		var url = require('url').parse(request.url, true);
    var pathfile = url.pathname;
    var query = url.query;

		// Test to see if it's a database query
    if (pathfile == '/temperature1_query.json') {
      console.log('temperature1_query.json');
      // Test to see if number of observations was specified as url query
      if (query.num_obs) {
        var num_obs = parseInt(query.num_obs);
      } else {
        // If not specified default to 20. Note use -1 in query string to get all.
        var num_obs = -1;
      }

      if (query.start_date) {
        var start_date = query.start_date;
      }
      else {
        var start_date = '1970-01-01T00:00';
      }   
      // Send a message to console log
      console.log('Database query request from '+ request.connection.remoteAddress +' for ' + num_obs + ' records from ' + start_date+'.');
      // call selectTemp function to get data from database
      selectTemp1(num_obs, start_date, function(data){
        response.writeHead(200, { "Content-type": "application/json" });		
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature2_query.json') {
      console.log('temperature2_query.json');
      // Test to see if number of observations was specified as url query
      if (query.num_obs) {
        var num_obs = parseInt(query.num_obs);
      } else {
        // If not specified default to 20. Note use -1 in query string to get all.
        var num_obs = -1;
      }

      if (query.start_date) {
        var start_date = query.start_date;
      }
      else {
        var start_date = '1970-01-01T00:00';
      }   
      // Send a message to console log
      console.log('Database query request from '+ request.connection.remoteAddress +' for ' + num_obs + ' records from ' + start_date+'.');
      // call selectTemp function to get data from database
      selectTemp2(num_obs, start_date, function(data){
        response.writeHead(200, { "Content-type": "application/json" });		
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature3_query.json') {
      console.log('temperature3_query.json');
      // Test to see if number of observations was specified as url query
      if (query.num_obs) {
        var num_obs = parseInt(query.num_obs);
      } else {
        // If not specified default to 20. Note use -1 in query string to get all.
        var num_obs = -1;
      }

      if (query.start_date) {
        var start_date = query.start_date;
      }
      else {
        var start_date = '1970-01-01T00:00';
      }   
      // Send a message to console log
      console.log('Database query request from '+ request.connection.remoteAddress +' for ' + num_obs + ' records from ' + start_date+'.');
      // call selectTemp function to get data from database
      selectTemp3(num_obs, start_date, function(data){
        response.writeHead(200, { "Content-type": "application/json" });		
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature4_query.json') {
      console.log('temperature4_query.json');
      // Test to see if number of observations was specified as url query
      if (query.num_obs) {
        var num_obs = parseInt(query.num_obs);
      } else {
        // If not specified default to 20. Note use -1 in query string to get all.
        var num_obs = -1;
      }

      if (query.start_date) {
        var start_date = query.start_date;
      }
      else {
        var start_date = '1970-01-01T00:00';
      }   
      // Send a message to console log
      console.log('Database query request from '+ request.connection.remoteAddress +' for ' + num_obs + ' records from ' + start_date+'.');
      // call selectTemp function to get data from database
      selectTemp4(num_obs, start_date, function(data){
        response.writeHead(200, { "Content-type": "application/json" });		
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }



    // Test to see if it's a request for current temperature   
    if (pathfile == '/temperature1_now.json') {
      readTemp(t1, function (data) {
        response.writeHead(200, { "Content-type": "application/json" });		
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature2_now.json') {
      readTemp(t2, function (data) {
        response.writeHead(200, { "Content-type": "application/json" });
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature3_now.json') {
      readTemp(t3, function (data) {
        response.writeHead(200, { "Content-type": "application/json" });
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }
    else if (pathfile == '/temperature4_now.json') {
      readTemp(t4, function (data) {
        response.writeHead(200, { "Content-type": "application/json" });
        response.end(JSON.stringify(data), "ascii");
      });
      return;
    }

    // Handler for favicon.ico requests
    if (pathfile == '/favicon.ico') {
      response.writeHead(200, {'Content-Type': 'image/x-icon'});
			response.end();

			// Optionally log favicon requests.
			//console.log('favicon requested');
			return;
		}
		else {
			// Print requested file to terminal
			console.log('Request from '+ request.connection.remoteAddress +' for: ' + pathfile);

			// Serve file using node-static			
			staticServer.serve(request, response, function (err, result) {
        if (err){
          // Log the error
          sys.error("Error serving " + request.url + " - " + err.message);

          // Respond to the client
          response.writeHead(err.status, err.headers);
          response.end('Error 404 - file not found');
          return;
        }
        return;	
      })
    }
});

// Start temperature logging (every 5 min).
var msecs = (60 * 5) * 1000; // log interval duration in milliseconds
logTemp(msecs);
// Send a message to console
console.log('Server is logging to database at '+msecs+'ms intervals');
// Enable server
var server_address = 8000;
server.listen(server_address);
// Log message
console.log('Server running at http://localhost:', server_address);
