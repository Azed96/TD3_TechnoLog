const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
let testssn;




const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const PORT = 3000,
    request = require('request'),
    fetch = require('node-fetch');
server.listen(PORT);
console.log('Server is running');
const rp = require('request-promise');


const connections = [];
let questionMap = new Map();
questionMap.set(0, ' Vueillez saisir votre prénom SVP');
questionMap.set(1, ' Vueillez saisir votre nom');
questionMap.set(2, ' Votre SSN SVP');
let cpt = 0;

let dataMap = new Map();
let serverResponse = '';


io.sockets.on('connection', (socket) => {
    connections.push(socket);
    console.log(' %s sockets is connected', connections.length);
    io.sockets.emit('new message', { message: questionMap.get(cpt) });


    socket.on('disconnect', () => {
        connections.splice(connections.indexOf(socket), 1);
    });

    socket.on('sending message', (message) => {
        console.log('Message is received :', message);
        io.sockets.emit('new message', { message: ' ==> you said : ' + message });

        cpt++;
        if (cpt != 3) {
            io.sockets.emit('new message', { message: questionMap.get(cpt) });

        }
        console.log('Message send  :',
            { message: questionMap.get(cpt) },
            ' cpt = ', cpt);

        if (cpt == 1) {
            dataMap.set('birthname', message);
        }

        if (cpt == 2) {
            dataMap.set('lastname', message);
        }

        if (cpt == 3) {
            dataMap.set('ssn', message);
            testssn = new SSN(dataMap.get('ssn'));
            if (!testssn.isValid()){
                io.sockets.emit('new message', { message: 'Votre numéro de sécurité sociale n`est pas valide' });
            }
            asyncCall();
            cpt = 0;
        }





    });
});


function asyncCall() {
    let postData = {
        lastname: dataMap.get('birthname'),
        birthname: dataMap.get('lastname'),
        ssn: dataMap.get('ssn')
    };



    const clientServerOptions = {
        uri: 'http://localhost:3011/people/',
        body: postData,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        json: true // Automatically stringifies the body to JSON

    };

    request(clientServerOptions, function (error, response, body) {
        if (error != null) {
            console.log('error:', error);
        }
        else {

            serverResponse = body;
            console.log('statusCode:',
                response && response.statusCode, 'BODY ', serverResponse);

            io.sockets.emit('new message', {
                message:
                    JSON.stringify(serverResponse)
            });


        }

    });



}


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


class SSN {
    constructor(secu) {
        this.secu_number = secu;
    }
    // ------------------------------------------------------------------------------------------------------------
    // VALIDITY STUFF
    // ------------------------------------------------------------------------------------------------------------
    isValid() {
        // ---- is Valid if enough char and key ok
        return this.controlSsnValue() && this.controlSsnKey();
    }
    /**
     * Private function to check value
     */
    controlSsnValue() {
        let regExpSsn = new RegExp("^" +
            "([1-37-8])" +
            "([0-9]{2})" +
            "(0[0-9]|[2-35-9][0-9]|[14][0-2])" +
            "((0[1-9]|[1-8][0-9]|9[0-69]|2[abAB])(00[1-9]|0[1-9][0-9]|[1-8][0-9]{2}|9[0-8][0-9]|990)|(9[78][0-9])(0[1-9]|[1-8][0-9]|90))" +
            "(00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})" +
            "(0[1-9]|[1-8][0-9]|9[0-7])$");
        return regExpSsn.test(this.secu_number);
    }
    /**
     * Private function to check NIR
     */
    controlSsnKey() {
        // -- Extract classic information
        let myValue = this.secu_number.substr(0, 13);
        let myNir = this.secu_number.substr(13);
        // -- replace special value like corsica
        myValue.replace('2B', "18").replace("2A", "19");
        // -- transform as number
        let myNumber = +myValue;
        return (97 - (myNumber % 97) == +myNir);
    }
    // ------------------------------------------------------------------------------------------------------------
    // INFO STUFF
    // ------------------------------------------------------------------------------------------------------------
    getInfo() {
        return {
            sex: this.extractSex(),
            birthDate: this.extractbirthDate(),
            birthPlace: this.extractBirthPlace(),
            birthPosition: this.extractPosition()
        };
    }
    /**
     *
     */
    extractSex() {
        let sex = this.secu_number.substr(0, 1);
        return sex == "1" || sex == "3" || sex == "8" ? "Homme" : "Femme";
    }
    /**
     *
     */
    extractbirthDate() {
        // -- Build a date
        let month = +this.secu_number.substr(3, 2);
        // -- special case
        if (month == 62 || month == 63) {
            month = 1;
        }
        let birth = new Date(+this.secu_number.substr(1, 2), month);
        return birth;
    }
    /**
     *
     */
    extractBirthPlace() {
        let dept = +this.secu_number.substr(5, 2);
        // --- Case DOM TOM
        if (dept == 97 || dept == 98) {
            return {
                dept: this.secu_number.substr(5, 3),
                commune: this.secu_number.substr(8, 2),
            };
        }
        else if (dept == 99) {
            return {
                dept: "Etranger",
                pays: this.secu_number.substr(7, 3)
            };
        }
        else {
            return {
                dept: this.secu_number.substr(5, 2),
                commune: this.secu_number.substr(7, 3),
            };
        }
    }
    /**
     *
     */
    extractPosition() {
        return +this.secu_number.substr(10, 3);
    }
}
