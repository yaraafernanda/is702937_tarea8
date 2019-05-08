'use strict'
const express = require('express');
const fs = require('fs');
const chalk = require('chalk');
const bodyParser = require('body-parser');
const cors = require('cors');

//npm i body-parser --save
const app = express()
const port = 3000
let productos = JSON.parse(fs.readFileSync('productos.json'));
let usuarios = JSON.parse(fs.readFileSync('usuarios.json'));

//NECESARIO?
let corsOptions = {
    origin: 'http://127.0.0.1:5500'
}

let jsonParser = bodyParser.json();
app.use(jsonParser);
app.use(cors(corsOptions));
app.use(express.static(__dirname + '/public'))

app.use(log); //middleware para todas las rutas.

app.get('/', (req, res) => res.send('Hello DASWorld!'))

app.route('/api/producto')
    .get((req, res) => {
        if (req.query.marca) {
            console.log(chalk.bold.blue(req.query.marca))
            let productosFiltro = productos.filter((pd) => {
                let comp = pd.marca.localeCompare(req.query.marca);
                if (comp == 0) {
                    return true;
                } else {
                    return false;
                }
            })
            res.json(productosFiltro);
        } else {
            res.json(productos);
        }
    })
    .post(auth, (req, res) => {
        let body = req.body;

        console.log(chalk.blue.bold(JSON.stringify(req.body)));
        if (body.nombre && body.marca && body.precio > 0 && body.descripcion && body.existencia > 0) {
            //Generar ID
            body.id = productos[productos.length - 1].id + 1;
            productos.push(body);
            fs.writeFileSync('productos.json', JSON.stringify(productos));
            console.log(chalk.blue.bold(JSON.stringify(req.body)));
            console.log(req.body.nombre);
            res.status(201).send(body);

            res.set('Content-Type', 'application/json');
            return;
        }
        res.status(400).send({
            error: "Faltan atributos en el body o el precio y/o existencia es 0 o un número negativo"
        })
    })

app.route('/api/producto/:id')
    .get((req, res) => {
        let id = req.params.id;
        let producto = productos.find(al => al.id == id);
        console.log("id:" + id);
        if (producto) {
            res.json(producto);
        } else {
            res.json({
                error: "no existe"
            });
        }
    })
    .patch(auth, (req, res) => {
        let id = req.params.id;
        let body = req.body;

        if (body.precio <= 0 || body.existencia <= 0) {
            res.status(400).send({
                error: "El precio y/o existencia del producto que deseas actualizar es 0 o un número negativo"
            })
        } else {
            if (partialUpdateProducto(id, body)) {
                let index = productos.findIndex(pd => pd.id == id);
                res.status(200).send(productos[index]);
            } else {
                res.status(400).send({
                    error: "Faltan datos o id incorrecto"
                })
            }
        }
    })

app.route('/api/usuario/login')
    .post((req, res) => {
        let body = req.body;
        if (body.usuario && body.password) {

            let username = req.body.usuario;
            let pass = req.body.password;
            let pos = usuarios.findIndex(usr => usr.usuario == username);
            console.log(pos);
            if (pos == -1 || pass.length <= 6) {
                res.status(406).send({
                    error: "El usuario no existe o la contraseña es menor a 6 caracteres"
                });
                return;
            }
            let token = generateToken(10);
            usuarios[pos].token = token;
            usuarios[pos].time = new Date();

            //ENVIAR HEADER
            res.set({
                'Content-Type': 'application/json',
                'x-auth': token,
                'x-user': username
            });

            fs.writeFileSync('usuarios.json', JSON.stringify(usuarios));
            console.log(chalk.blue.bold(JSON.stringify(req.body)));
            res.status(200).send(body.usuario);

            return;
        }
        res.status(400).send({
            error: " Faltan atributos en el body"
        })
    })

app.route('/api/usuario/logout')
    .post(auth, (req, res) => {

        let userLogged = req.get('x-user');
        let pos = usuarios.findIndex(usr => usr.usuario == userLogged);
        usuarios[pos].token = "";
        usuarios[pos].time = "";

        fs.writeFileSync('usuarios.json', JSON.stringify(usuarios));
        console.log(chalk.blue.bold(JSON.stringify(req.body)));
        console.log(req.body.nombre);
        res.status(200).send();
        return;
    })

app.listen(port, () => console.log(`Example app listening on port http://127.0.0.1:${port}`))

function partialUpdateProducto(id, producto) {
    let pos = productos.findIndex(pd => pd.id == id);

    productos[pos].nombre = (producto.nombre) ? producto.nombre : productos[pos].nombre;
    productos[pos].marca = (producto.marca) ? producto.marca : productos[pos].marca;
    productos[pos].precio = (producto.precio) ? producto.precio : productos[pos].precio;
    productos[pos].descripcion = (producto.descripcion) ? producto.descripcion : productos[pos].descripcion;
    productos[pos].existencia = (producto.existencia) ? producto.existencia : productos[pos].existencia;

    Object.assign(productos[pos], producto);
    fs.writeFileSync('productos.json', JSON.stringify(productos));
    return true;

}

function generateToken(sLength) {
    let random_string = '';
    let random_ascii;
    for (let i = 0; i < sLength; i++) {
        random_ascii = Math.floor((Math.random() * 25) + 97);
        random_string += String.fromCharCode(random_ascii)
    }
    return random_string
}

function auth(req, res, next) {
    //Obtener token y usuario
    let token = req.get('x-auth');
    let userLogged = req.get('x-user');
    //Obtener la hora actual y la hora de creación del token
    let now = new Date();
    let pos = usuarios.findIndex(usr => usr.usuario == userLogged);
    //Sacar diferencia en minutos
    let diff = now - Date.parse(usuarios[pos].time);
    var diffMins = Math.round(((diff % 86400000) % 3600000) / 60000); // minutes
    console.log(diffMins);
    //Validación del tiempo
    if (diffMins >= 5) {
        res.status(401).send({
            error: "El tiempo de autenticación del token proporcionado excede los 5 minutos"
        })
        return;
    }
    if (usuarios[pos].token != token) {
        res.status(401).send({
            error: "El usuario no está autentificado (token no validado)"
        })
        return;
    }
    next(); //ejecuta la siguiente función
}

function log(req, res, next) {
    console.log("Método: ", chalk.bold.blue(req.method));
    //obtener algún header
    console.log("content-type: ", chalk.bold.blue(req.get('Content-Type')));
    console.log("x-auth: ", chalk.bold.blue(req.get('x-auth')));
    console.log("url: ", chalk.bold.blue(req.originalUrl));
    console.log("Fecha: ", chalk.bold.blue(new Date(Date.now()).toString()));
    console.log("Solicitud: ", chalk.bold.blue(req.body));
    
    next(); //ejecuta la siguiente función
}