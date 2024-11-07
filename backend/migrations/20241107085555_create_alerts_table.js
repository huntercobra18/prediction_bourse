exports.up = function (knex) {
    return knex.schema.createTable('alerts', (table) => {
      table.increments('id').primary();
      table.string('symbol');
      table.float('price');
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTableIfExists('alerts');
  };
