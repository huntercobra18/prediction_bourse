// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuration de l'environnement
const environment = process.env.NODE_ENV || 'development';
const knexConfig = require('./knexfile')[environment];
const knex = require('knex')(knexConfig);

app.use(cors());
app.use(express.json());

let stocks = [];

const indices = [
    { symbol: 'BTC', name: 'Bitcoin', basePrice: 30000 },
    { symbol: 'CAC40', name: 'CAC 40', basePrice: 6000 },
    { symbol: 'SP500', name: 'S&P 500', basePrice: 4000 },
];

// Fonction pour initialiser le serveur
function initializeServer(knexInstance) {
    // Endpoints API REST pour les stocks
    app.get('/api/stocks', (req, res) => {
        res.json(stocks);
    });

    app.post('/api/stocks', (req, res) => {
        const stock = req.body;
        stocks.push(stock);
        res.status(201).json(stock);
    });

    // Endpoints API REST pour les alertes
    app.post('/api/alerts', (req, res) => {
        const { symbol, price } = req.body;
        knexInstance('alerts')
            .insert({ symbol, price })
            .then(() => res.status(201).json({ message: 'Alerte créée avec succès' }))
            .catch((err) => {
                console.error('Error inserting alert:', err);
                res.status(500).json({ error: err.message });
            });
    });

    app.get('/api/alerts', (req, res) => {
        knexInstance('alerts')
            .select('*')
            .then((alerts) => res.json(alerts))
            .catch((err) => {
                console.error('Error fetching alerts:', err);
                res.status(500).json({ error: err.message });
            });
    });

    app.delete('/api/alerts/:id', (req, res) => {
        const { id } = req.params;
        knexInstance('alerts')
            .where({ id })
            .del()
            .then(() => res.status(204).end())
            .catch((err) => {
                console.error('Error deleting alert:', err);
                res.status(500).json({ error: err.message });
            });
    });

    // Fonction pour générer les données simulées
    async function generateSimulatedStockData() {
        const data = indices.map((index) => {
            const randomFactor = (Math.random() * 2 - 1) * 0.02; // Variation de +/-2%
            const newPrice = index.basePrice * (1 + randomFactor);
            index.basePrice = newPrice;

            return {
                symbol: index.symbol,
                name: index.name,
                price: newPrice.toFixed(2),
                timestamp: new Date(),
            };
        });

        // Vérifier les alertes
        for (const item of data) {
            const alerts = await knexInstance('alerts')
                .where('symbol', item.symbol)
                .andWhere('price', '<=', item.price);

            if (alerts.length > 0) {
                // Envoyer une notification au client via WebSocket
                io.emit('PriceAlert', {
                    symbol: item.symbol,
                    name: item.name,
                    price: item.price,
                    alerts: alerts,
                });

                // Supprimer les alertes déclenchées
                const alertIds = alerts.map((alert) => alert.id);
                await knexInstance('alerts').whereIn('id', alertIds).del();
            }
        }

        return data;
    }

    // Initialisation de Socket.io
    const server = http.createServer(app);
    const io = socketIo(server, {
        cors: {
            origin: '*',
        },
    });

    io.on('connection', (socket) => {
        console.log('New client connected');

        // Envoyer des données toutes les deux secondes
        const interval = setInterval(async () => {
            const simulatedData = await generateSimulatedStockData();
            socket.emit('FromAPI', simulatedData);
        }, 2000);

        socket.on('disconnect', () => {
            clearInterval(interval);
            console.log('Client disconnected');
        });
    });

    // Démarrer le serveur
    if (require.main === module) {
        // Appliquer les migrations et démarrer le serveur uniquement si le fichier est exécuté directement
        knexInstance.migrate
            .latest()
            .then(() => {
                server.listen(5001, () => {
                    console.log('Server is running on http://localhost:5001');
                });
            })
            .catch((err) => {
                console.error('Failed to start server:', err);
            });
    }

    return server;
}

// Exporter l'application Express et la fonction pour initialiser le serveur
module.exports = { app, initializeServer };
