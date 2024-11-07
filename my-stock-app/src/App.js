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
import { Card, Typography } from 'antd';
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
          const rsi = calculateRSI(prices);
          const bollinger = calculateBollingerBands(prices);
          const macd = calculateMACD(prices);
          const regression = linearRegression(prices);
          const sma = calculateSMA(prices, 14);
          const indicators = {
            ...prevState.indicators,
            [item.symbol]: {
              rsi: rsi[rsi.length - 1],
              bollinger,
              macd,
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
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  render() {
    const { realtimeData, chartData, indicators } = this.state;
    return (
      <div className="App">
        <Title level={1}>Données de Stock en Temps Réel avec Indicateurs Techniques</Title>
        {realtimeData.map((data) => {
          const symbolIndicators = indicators[data.symbol] || {};
          const symbolChartData = chartData[data.symbol] || [];
          const prices = symbolChartData.map((d) => d.price);
          const timestamps = symbolChartData.map((d) => d.timestamp);
          const bollingerData = symbolIndicators.bollinger || {};
          const regressionData = symbolIndicators.regression || {};
          const smaData = symbolIndicators.sma || [];
          const macdData = symbolIndicators.macd || {};
          const rsiValue = symbolIndicators.rsi || 0;
          const chartDataWithIndicators = symbolChartData.map((d, i) => ({
            ...d,
            upperBand: bollingerData.upperBand ? bollingerData.upperBand[i - (bollingerData.upperBand.length - prices.length)] : null,
            lowerBand: bollingerData.lowerBand ? bollingerData.lowerBand[i - (bollingerData.lowerBand.length - prices.length)] : null,
            sma: smaData[i - (smaData.length - prices.length)] || null,
            regression: regressionData.predictions ? regressionData.predictions[i - (regressionData.predictions.length - prices.length)] : null,
          }));
          return (
            <Card key={data.symbol} className="stock-container">
              <Title level={2}>
                {data.name} ({data.symbol})
              </Title>
              <Text strong>Prix :</Text> {parseFloat(data.price).toFixed(2)}
              <br />
              <Text strong>Heure :</Text> {new Date(data.timestamp).toLocaleTimeString()}
              <br />
              <Text strong>RSI :</Text> {rsiValue ? rsiValue.toFixed(2) : 'Calcul en cours...'}
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartDataWithIndicators}>
                    <CartesianGrid stroke="#e0e0e0" />
                    <XAxis dataKey="timestamp" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" yAxisId={0} isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="upperBand" stroke="#82ca9d" yAxisId={0} isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="lowerBand" stroke="#82ca9d" yAxisId={0} isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="sma" stroke="#ffc658" yAxisId={0} isAnimationActive={false} dot={false} />
                    <Line type="monotone" dataKey="regression" stroke="#ff7300" yAxisId={0} isAnimationActive={false} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
}

export default App;

function calculateRSI(prices, period = 14) {
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
  rsi[period] = 100 - 100 / (1 + rs);
  for (let i = period + 1; i < prices.length; i++) {
    const gain = gains[i - 1];
    const loss = losses[i - 1];
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    rs = averageGain / averageLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function calculateBollingerBands(prices, period = 20, k = 2) {
  const sma = [];
  const upperBand = [];
  const lowerBand = [];
  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    sma.push(mean);
    upperBand.push(mean + k * sd);
    lowerBand.push(mean - k * sd);
  }
  return { sma, upperBand, lowerBand };
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const emaArray = [];
  let ema = prices[0];
  emaArray.push(ema);
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  const macdLine = emaFast.map((value, index) => value - emaSlow[index]);
  const signalLine = calculateEMA(macdLine.slice(slowPeriod - 1), signalPeriod);
  const histogram = macdLine.slice(slowPeriod - 1).map((value, index) => value - signalLine[index]);
  return {
    macdLine: macdLine.slice(slowPeriod - 1),
    signalLine,
    histogram,
  };
}

function linearRegression(prices) {
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
  const predictions = x.map((xi) => a * xi + b);
  return { a, b, predictions };
}

function calculateSMA(prices, period) {
  const sma = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}
