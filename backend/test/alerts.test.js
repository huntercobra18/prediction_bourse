const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;
const { app, initializeServer } = require('../server');
const knexConfig = require('../knexfile').test;
const knex = require('knex')(knexConfig);

let server;

describe('API Alerts', () => {
  before(async () => {
    // Appliquer les migrations pour créer la table des alertes
    await knex.migrate.rollback();
    await knex.migrate.latest();

    // Initialiser le serveur avec l'instance de Knex de test
    server = initializeServer(knex);
  });

  after(async () => {
    // Arrêter le serveur et détruire la connexion à la base de données
    await knex.destroy();
    if (server && server.close) server.close();
  });

  beforeEach(async () => {
    // Vider la table des alertes avant chaque test
    await knex('alerts').truncate();
  });

  it('should create a new alert', (done) => {
    const alert = {
      symbol: 'BTC',
      price: 32000,
    };

    request(app)
      .post('/api/alerts')
      .send(alert)
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('message', 'Alerte créée avec succès');
        done();
      });
  });

  it('should get all alerts', (done) => {
    // Créer une alerte d'abord
    knex('alerts')
      .insert({ symbol: 'BTC', price: 32000 })
      .then(() => {
        request(app)
          .get('/api/alerts')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.be.an('array');
            expect(res.body.length).to.equal(1);
            done();
          });
      });
  });

  it('should delete an alert', (done) => {
    // D'abord, créer une alerte pour pouvoir la supprimer
    knex('alerts')
      .insert({ symbol: 'BTC', price: 31000 })
      .then((ids) => {
        const alertId = ids[0];

        // Supprimer l'alerte
        request(app)
          .delete(`/api/alerts/${alertId}`)
          .expect(204)
          .end((err) => {
            if (err) return done(err);

            // Vérifier que l'alerte a été supprimée
            knex('alerts')
              .where({ id: alertId })
              .then((alerts) => {
                expect(alerts.length).to.equal(0);
                done();
              });
          });
      });
  });
});
