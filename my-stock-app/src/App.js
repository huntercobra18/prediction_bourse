import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import './App.css'; // Importer le fichier CSS

const ENDPOINT = 'http://localhost:5001';

function App() {
  const [realtimeData, setRealtimeData] = useState([]);
  const [chartData, setChartData] = useState({});
  const [alerts, setAlerts] = useState({});

  useEffect(() => {
    const socket = socketIOClient(ENDPOINT);
    socket.on('FromAPI', (data) => {
      setRealtimeData(data);

      // Mettre à jour les données du graphique
      data.forEach((item) => {
        setChartData((prevState) => ({
          ...prevState,
          [item.symbol]: [
            ...(prevState[item.symbol] || []),
            {
              timestamp: new Date(item.timestamp).toLocaleTimeString(),
              price: parseFloat(item.price),
            },
          ],
        }));
      });

      // Vérifier les alertes
      data.forEach((item) => {
        const alertPrice = alerts[item.symbol];
        if (alertPrice && item.price >= alertPrice) {
          alert(`Alerte! ${item.name} a atteint le prix de ${item.price}`);
        }
      });
    });

    return () => socket.disconnect();
  }, [alerts]);

  const handleAlertChange = (symbol, value) => {
    setAlerts({
      ...alerts,
      [symbol]: parseFloat(value),
    });
  };

  return (
    <div className="App">
      <h1>Données de Stock en Temps Réel</h1>
      {realtimeData.map((data) => (
        <div key={data.symbol} className="stock-container">
          <h2>
            {data.name} ({data.symbol})
          </h2>
          <p>Prix : {data.price}</p>
          <p>Heure : {new Date(data.timestamp).toLocaleTimeString()}</p>
          <label>
            Définir une alerte à :
            <input
              type="number"
              value={alerts[data.symbol] || ''}
              onChange={(e) => handleAlertChange(data.symbol, e.target.value)}
            />
          </label>

          {/* Afficher le graphique */}
          {chartData[data.symbol] && (
            <LineChart
              width={600}
              height={300}
              data={chartData[data.symbol]}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid stroke="#f5f5f5" />
              <XAxis dataKey="timestamp" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="price" stroke="#ff7300" yAxisId={0} />
            </LineChart>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;
