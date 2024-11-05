const express = require('express');
const cors = require('cors');
const app = express();
const port = 5001;
const http = require('http');
const socketIo = require('socket.io');

app.use(cors());
app.use(express.json());

let stocks = [];

const indices = [
    { symbol: 'BTC', name: 'Bitcoin', basePrice: 30000 },
    { symbol: 'CAC40', name: 'CAC 40', basePrice: 6000 },
    { symbol: 'SP500', name: 'S&P 500', basePrice: 4000 },
];

// Endpoints API REST
app.get('/api/stocks', (req, res) => {
    res.json(stocks);
});

app.post('/api/stocks', (req, res) => {
    const stock = req.body;
    stocks.push(stock);
    res.status(201).json(stock);
});

app.put('/api/stocks/:id', (req, res) => {
    const id = req.params.id;
    const updatedStock = req.body;
    stocks = stocks.map(stock => (stock.id === id ? updatedStock : stock));
    res.json(updatedStock);
});

app.delete('/api/stocks/:id', (req, res) => {
    const id = req.params.id;
    stocks = stocks.filter(stock => stock.id !== id);
    res.status(204).end();
});

// Création du serveur HTTP en utilisant l'application Express
const server = http.createServer(app);

// Initialisation de Socket.io sur le serveur
const io = socketIo(server, {
    cors: {
        origin: '*',
    },
});

io.on('connection', (socket) => {
    console.log('New client connected');

    // Envoyer des données toutes les secondes
    const interval = setInterval(() => {
        const simulatedData = generateSimulatedStockData();
        socket.emit('FromAPI', simulatedData);
    }, 2000);

    socket.on('disconnect', () => {
        clearInterval(interval);
        console.log('Client disconnected');
    });
});

function generateSimulatedStockData() {
    return indices.map((index) => {
        // Générer une variation basée sur la précédente
        const randomFactor = (Math.random() * 2 - 1) * 0.02; // Variation de +/-2%
        const newPrice = index.basePrice * (1 + randomFactor);

        // Mettre à jour la basePrice pour la prochaine itération
        index.basePrice = newPrice;

        return {
            symbol: index.symbol,
            name: index.name,
            price: newPrice.toFixed(2),
            timestamp: new Date(),
        };
    });
}

// Écoute du serveur sur le port spécifié
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
