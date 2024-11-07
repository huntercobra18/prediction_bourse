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
import { Card, Typography, InputNumber, Button, Modal, Form, notification } from 'antd';
import './App.css';

const { Title, Text } = Typography;
const ENDPOINT = 'http://localhost:5001';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            realtimeData: [],
            chartData: {},
            indicators: {},
            alerts: {},
            isModalVisible: false,
            selectedSymbol: '',
            alertPrice: null,
        };
        this.socket = null;
    }

    componentDidMount() {
        this.socket = socketIOClient(ENDPOINT);

        this.socket.on('FromAPI', (data) => {
            this.setState({ realtimeData: data });
            data.forEach((item) => {
                const price = parseFloat(item.price);
                this.setState((prevState) => {
                    const symbolData = prevState.chartData[item.symbol] || [];
                    const updatedSymbolData = [
                        ...symbolData,
                        {
                            timestamp: new Date(item.timestamp).toLocaleTimeString(),
                            price,
                        },
                    ];
                    const prices = updatedSymbolData.map((d) => d.price);

                    let rsi = [];
                    if (prices.length >= 14) {
                        rsi = calculateRSI(prices);
                    }

                    let bollinger = {};
                    if (prices.length >= 20) {
                        bollinger = calculateBollingerBands(prices);
                    }

                    let regression = {};
                    if (prices.length >= 2) {
                        regression = linearRegression(prices);
                    }

                    let sma = [];
                    if (prices.length >= 14) {
                        sma = calculateSMA(prices, 14);
                    }

                    const indicators = {
                        ...prevState.indicators,
                        [item.symbol]: {
                            rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
                            bollinger,
                            regression,
                            sma,
                        },
                    };

                    return {
                        chartData: {
                            ...prevState.chartData,
                            [item.symbol]: updatedSymbolData,
                        },
                        indicators,
                    };
                });
            });
        });

        this.socket.on('PriceAlert', (data) => {
            notification.warning({
                message: `Alerte de Prix pour ${data.symbol}`,
                description: `Le prix a atteint ${data.price}€`,
            });
            this.fetchAlerts();
        });

        this.fetchAlerts();
    }

    componentWillUnmount() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    fetchAlerts = () => {
        fetch(`${ENDPOINT}/api/alerts`)
            .then((res) => res.json())
            .then((alerts) => {
                const alertsBySymbol = {};
                alerts.forEach((alert) => {
                    if (!alertsBySymbol[alert.symbol]) {
                        alertsBySymbol[alert.symbol] = [];
                    }
                    alertsBySymbol[alert.symbol].push(alert);
                });
                this.setState({ alerts: alertsBySymbol });
            })
            .catch((err) => console.error('Error fetching alerts:', err));
    };

    showModal = (symbol) => {
        this.setState({ isModalVisible: true, selectedSymbol: symbol, alertPrice: null });
    };

    handleOk = () => {
        const { selectedSymbol, alertPrice } = this.state;
        if (alertPrice && selectedSymbol) {
            fetch(`${ENDPOINT}/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: selectedSymbol, price: alertPrice }),
            })
                .then((res) => res.json())
                .then(() => {
                    notification.success({
                        message: 'Alerte Créée',
                        description: `Une alerte a été créée pour ${selectedSymbol} à ${alertPrice}€`,
                    });
                    this.setState({ isModalVisible: false, alertPrice: null });
                    this.fetchAlerts();
                })
                .catch((err) => console.error('Error creating alert:', err));
        }
    };

    handleCancel = () => {
        this.setState({ isModalVisible: false, alertPrice: null });
    };

    deleteAlert = (id) => {
        fetch(`${ENDPOINT}/api/alerts/${id}`, {
            method: 'DELETE',
        })
            .then(() => {
                notification.info({
                    message: 'Alerte Supprimée',
                    description: `L'alerte a été supprimée`,
                });
                this.fetchAlerts();
            })
            .catch((err) => console.error('Error deleting alert:', err));
    };

    render() {
        const { realtimeData, chartData, indicators, alerts, isModalVisible, selectedSymbol, alertPrice } = this.state;
        return (
            <div className="App">
                <Title level={1}>Données de Stock en Temps Réel avec Indicateurs Techniques</Title>
                {realtimeData.map((data) => {
                    const symbolIndicators = indicators[data.symbol] || {};
                    const symbolChartData = chartData[data.symbol] || [];
                    const prices = symbolChartData.map((d) => d.price);
                    const bollingerData = symbolIndicators.bollinger || {};
                    const regressionData = symbolIndicators.regression || {};
                    const smaData = symbolIndicators.sma || [];
                    const rsiValue = symbolIndicators.rsi || null;

                    const chartDataWithIndicators = symbolChartData.map((d, i) => ({
                        ...d,
                        upperBand:
                            bollingerData.upperBand && bollingerData.upperBand[i - (bollingerData.upperBand.length - prices.length)]
                                ? bollingerData.upperBand[i - (bollingerData.upperBand.length - prices.length)]
                                : null,
                        lowerBand:
                            bollingerData.lowerBand && bollingerData.lowerBand[i - (bollingerData.lowerBand.length - prices.length)]
                                ? bollingerData.lowerBand[i - (bollingerData.lowerBand.length - prices.length)]
                                : null,
                        sma:
                            smaData[i - (smaData.length - prices.length)] !== undefined
                                ? smaData[i - (smaData.length - prices.length)]
                                : null,
                        regression:
                            regressionData.predictions &&
                                regressionData.predictions[i - (regressionData.predictions.length - prices.length)]
                                ? regressionData.predictions[i - (regressionData.predictions.length - prices.length)]
                                : null,
                    }));

                    return (
                        <Card key={data.symbol} className="stock-container">
                            <Title level={2}>
                                {data.name} ({data.symbol})
                            </Title>
                            <Text strong>Prix :</Text> {parseFloat(data.price).toFixed(4)}€
                            <br />
                            <Text strong>Heure :</Text> {new Date(data.timestamp).toLocaleTimeString()}
                            <br />
                            <Text strong>RSI :</Text> {rsiValue !== null ? rsiValue.toFixed(2) : 'Calcul en cours...'}
                            <br />
                            <Button type="primary" onClick={() => this.showModal(data.symbol)} style={{ marginTop: 10 }}>
                                Ajouter une Alerte de Prix
                            </Button>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={chartDataWithIndicators}>
                                        <CartesianGrid stroke="#e0e0e0" />
                                        <XAxis dataKey="timestamp" />
                                        <YAxis domain={['auto', 'auto']} tickFormatter={(value) => `${value}€`} />
                                        <Tooltip formatter={(value) => `${value}€`} />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="price"
                                            stroke="#8884d8"
                                            yAxisId={0}
                                            isAnimationActive={false}
                                            dot={false}
                                        />
                                        {bollingerData.upperBand && (
                                            <>
                                                <Line
                                                    type="monotone"
                                                    dataKey="upperBand"
                                                    stroke="#82ca9d"
                                                    yAxisId={0}
                                                    isAnimationActive={false}
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="lowerBand"
                                                    stroke="#82ca9d"
                                                    yAxisId={0}
                                                    isAnimationActive={false}
                                                    dot={false}
                                                />
                                            </>
                                        )}
                                        {smaData.length > 0 && (
                                            <Line
                                                type="monotone"
                                                dataKey="sma"
                                                stroke="#ffc658"
                                                yAxisId={0}
                                                isAnimationActive={false}
                                                dot={false}
                                            />
                                        )}
                                        {regressionData.predictions && (
                                            <Line
                                                type="monotone"
                                                dataKey="regression"
                                                stroke="#ff7300"
                                                yAxisId={0}
                                                isAnimationActive={false}
                                                dot={false}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            {alerts[data.symbol] && alerts[data.symbol].length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <Text strong>Alertes en Attente :</Text>
                                    <ul>
                                        {alerts[data.symbol].map((alert) => (
                                            <li key={alert.id}>
                                                Prix cible : {alert.price}€
                                                <Button
                                                    type="link"
                                                    danger
                                                    onClick={() => this.deleteAlert(alert.id)}
                                                    style={{ marginLeft: 10 }}
                                                >
                                                    Supprimer
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Card>
                    );
                })}

                <Modal
                    title={`Ajouter une Alerte pour ${selectedSymbol}`}
                    visible={isModalVisible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                    okText="Ajouter"
                    cancelText="Annuler"
                >
                    <Form layout="vertical">
                        <Form.Item label="Prix Cible (€)">
                            <InputNumber
                                min={0}
                                value={alertPrice}
                                onChange={(value) => this.setState({ alertPrice: value })}
                                style={{ width: '100%' }}
                                precision={4}
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        );
    }
}

export default App;

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return [];
    const gains = [];
    const losses = [];
    for (let i = 1; i < prices.length; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) {
            gains.push(difference);
            losses.push(0);
        } else {
            gains.push(0);
            losses.push(Math.abs(difference));
        }
    }
    let averageGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let averageLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const rsi = [];
    let rs = averageGain / averageLoss;
    let rsiValue = 100 - 100 / (1 + rs);
    rsi[period] = parseFloat(rsiValue.toFixed(2));
    for (let i = period + 1; i < prices.length; i++) {
        const gain = gains[i - 1];
        const loss = losses[i - 1];
        averageGain = (averageGain * (period - 1) + gain) / period;
        averageLoss = (averageLoss * (period - 1) + loss) / period;
        rs = averageGain / averageLoss;
        rsiValue = 100 - 100 / (1 + rs);
        rsi[i] = parseFloat(rsiValue.toFixed(2));
    }
    return rsi;
}

function calculateBollingerBands(prices, period = 20, k = 2) {
    if (prices.length < period) return {};
    const sma = [];
    const upperBand = [];
    const lowerBand = [];
    for (let i = period - 1; i < prices.length; i++) {
        const window = prices.slice(i - period + 1, i + 1);
        const mean = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const sd = Math.sqrt(variance);
        sma.push(parseFloat(mean.toFixed(4)));
        upperBand.push(parseFloat((mean + k * sd).toFixed(4)));
        lowerBand.push(parseFloat((mean - k * sd).toFixed(4)));
    }
    return { sma, upperBand, lowerBand };
}

function linearRegression(prices) {
    if (prices.length < 2) return {};
    const N = prices.length;
    const x = [...Array(N).keys()];
    const y = prices;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, idx) => sum + xi * y[idx], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const numeratorA = N * sumXY - sumX * sumY;
    const denominatorA = N * sumX2 - sumX * sumX;
    const a = numeratorA / denominatorA;
    const b = (sumY - a * sumX) / N;
    const predictions = x.map((xi) => parseFloat((a * xi + b).toFixed(4)));
    return { a: parseFloat(a.toFixed(4)), b: parseFloat(b.toFixed(4)), predictions };
}

function calculateSMA(prices, period) {
    if (prices.length < period) return [];
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(parseFloat((sum / period).toFixed(4)));
    }
    return sma;
}
