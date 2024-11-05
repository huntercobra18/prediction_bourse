import React, { useEffect, useState } from 'react';
import socketIOClient from 'socket.io-client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, InputNumber, Typography } from 'antd';
import './App.css';

const { Title, Text } = Typography;

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
      <Title level={1}>Données de Stock en Temps Réel</Title>
      {realtimeData.map((data) => (
        <Card key={data.symbol} className="stock-container">
          <Title level={2}>
            {data.name} ({data.symbol})
          </Title>
          <Text strong>Prix :</Text> {parseFloat(data.price).toFixed(2)}
          <br />
          <Text strong>Heure :</Text> {new Date(data.timestamp).toLocaleTimeString()}
          <div style={{ marginTop: '10px' }}>
            <label>
              Définir une alerte à :
              <InputNumber
                value={alerts[data.symbol] || ''}
                onChange={(value) => handleAlertChange(data.symbol, value)}
                style={{ marginLeft: '10px' }}
              />
            </label>
          </div>
          {chartData[data.symbol] && (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData[data.symbol]}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#e0e0e0" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#1890ff"
                    yAxisId={0}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default App;
