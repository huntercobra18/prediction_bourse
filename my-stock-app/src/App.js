import React from 'react';
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
import { Card, InputNumber, Typography, Button } from 'antd';
import './App.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const { Title, Text } = Typography;

const ENDPOINT = 'http://localhost:5001';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      realtimeData: [],
      chartData: {},
      alerts: {},
      alertInputs: {}, // Ajouté pour stocker les valeurs d'entrée
    };

    this.socket = null;
  }

  componentDidMount() {
    this.socket = socketIOClient(ENDPOINT);

    this.socket.on('FromAPI', (data) => {
      this.setState({ realtimeData: data });

      // Mettre à jour les données du graphique
      data.forEach((item) => {
        this.setState((prevState) => ({
          chartData: {
            ...prevState.chartData,
            [item.symbol]: [
              ...(prevState.chartData[item.symbol] || []),
              {
                timestamp: new Date(item.timestamp).toLocaleTimeString(),
                price: parseFloat(item.price),
              },
            ],
          },
        }));
      });

      // Vérifier les alertes
      data.forEach((item) => {
        const alertPrice = this.state.alerts[item.symbol];
        if (alertPrice && item.price >= alertPrice) {
          // L'alerte sera désormais gérée par le backend via WebSocket
        }
      });
    });

    // Ajouter l'écouteur pour les alertes de prix
    this.socket.on('PriceAlert', (alertData) => {
      toast.success(
        `Alerte! ${alertData.name} a atteint le prix de ${parseFloat(alertData.price).toFixed(2)}€`
      );
    });
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  handleAlertInputChange = (symbol, value) => {
    this.setState((prevState) => ({
      alertInputs: {
        ...prevState.alertInputs,
        [symbol]: value,
      },
    }));
  };

  handleAlertSubmit = (symbol) => {
    const alertPrice = parseFloat(this.state.alertInputs[symbol]);

    if (isNaN(alertPrice)) {
      toast.error('Veuillez entrer un montant valide pour l\'alerte');
      return;
    }

    // Envoyer l'alerte au backend
    fetch('http://localhost:5001/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbol, price: alertPrice }),
    })
      .then((response) => {
        if (response.ok) {
          toast.info(`Alerte pour ${symbol} à ${alertPrice}€ créée avec succès`);
          this.setState((prevState) => ({
            alerts: {
              ...prevState.alerts,
              [symbol]: alertPrice,
            },
            alertInputs: {
              ...prevState.alertInputs,
              [symbol]: '', // Réinitialiser le champ d'entrée
            },
          }));
        } else {
          toast.error("Erreur lors de la création de l'alerte");
        }
      })
      .catch(() => {
        toast.error("Erreur lors de la création de l'alerte");
      });
  };

  render() {
    const { realtimeData, chartData, alerts, alertInputs } = this.state;

    return (
      <div className="App">
        <ToastContainer />
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
                  value={alertInputs[data.symbol] || ''}
                  onChange={(value) => this.handleAlertInputChange(data.symbol, value)}
                  style={{ marginLeft: '10px', marginRight: '10px' }}
                />
              </label>
              <Button
                type="primary"
                onClick={() => this.handleAlertSubmit(data.symbol)}
              >
                Valider
              </Button>
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
}

export default App;
