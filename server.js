const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  host: process.env.DB_HOST || 'geral_mariadb',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'max',
  password: process.env.DB_PASSWORD || '148ciapm',
  database: process.env.DB_NAME || 'geral'
};

async function inicializarBanco() {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS resultados_simulado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        disciplina VARCHAR(50) NOT NULL DEFAULT 'banco_dados',
        aluno VARCHAR(150) NOT NULL,
        acertos INT NOT NULL,
        total_questoes INT NOT NULL,
        nota DECIMAL(4,2) NOT NULL,
        respostas_json JSON NOT NULL,
        data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Garante a coluna disciplina caso a tabela já tenha sido criada antes
    await conn.execute(`
      ALTER TABLE resultados_simulado 
      ADD COLUMN IF NOT EXISTS disciplina VARCHAR(50) NOT NULL DEFAULT 'banco_dados' AFTER id;
    `);
    await conn.end();
    console.log('Banco de dados pronto!');
  } catch (err) {
    console.error('Erro ao iniciar banco:', err.message);
  }
}

// Gabaritos separados por disciplina
const gabaritos = {
  banco_dados: {
    q1: 'b', q2: 'c', q3: 'b', q4: 'a', q5: 'c',
    q6: 'b', q7: 'a', q8: 'c', q9: 'b', q10: 'c',
    q11: 'b', q12: 'b', q13: 'b', q14: 'b', q15: 'a',
    q16: 'b', q17: 'a', q18: 'b', q19: 'b', q20: 'b',
    q21: 'b', q22: 'c', q23: 'b', q24: 'c', q25: 'b',
    q26: 'a', q27: 'b', q28: 'a', q29: 'b', q30: 'b',
    q31: 'b', q32: 'a', q33: 'b', q34: 'b', q35: 'b',
    q36: 'b', q37: 'b', q38: 'b', q39: 'c', q40: 'b'
  },
  programacao_web: {
    q1: 'b', q2: 'c', q3: 'a', q4: 'd', q5: 'b',
    q6: 'c', q7: 'a', q8: 'b', q9: 'd', q10: 'c',
    q11: 'b', q12: 'a', q13: 'c', q14: 'b', q15: 'd',
    q16: 'c', q17: 'b', q18: 'a', q19: 'd', q20: 'b',
    q21: 'c', q22: 'b', q23: 'a', q24: 'd', q25: 'b',
    q26: 'c', q27: 'a', q28: 'b', q29: 'd', q30: 'c'
  }
};

app.post('/avaliar', async (req, res) => {
  const { disciplina = 'banco_dados', aluno, respostas } = req.body;
  const gabarito = gabaritos[disciplina];

  if (!gabarito || !aluno || !respostas) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados inválidos ou disciplina não encontrada.' });
  }

  let acertos = 0;
  const total = Object.keys(gabarito).length;

  for (const [questao, correta] of Object.entries(gabarito)) {
    if (respostas[questao] && respostas[questao].toLowerCase() === correta) {
      acertos++;
    }
  }

  const nota = Number(((acertos / total) * 10).toFixed(2));

  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      'INSERT INTO resultados_simulado (disciplina, aluno, acertos, total_questoes, nota, respostas_json) VALUES (?, ?, ?, ?, ?, ?)',
      [disciplina, aluno.trim(), acertos, total, nota, JSON.stringify(respostas)]
    );
    await conn.end();

    res.json({ status: 'ok', disciplina, aluno: aluno.trim(), acertos, total, nota });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao salvar no banco de dados.' });
  }
});

// Permite filtrar notas por disciplina na URL: /notas ou /notas?disciplina=programacao_web
app.get('/notas', async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const { disciplina } = req.query;
    let query = 'SELECT id, disciplina, aluno, acertos, total_questoes, nota, data_envio FROM resultados_simulado';
    const params = [];

    if (disciplina) {
      query += ' WHERE disciplina = ?';
      params.push(disciplina);
    }

    query += ' ORDER BY disciplina ASC, nota DESC, data_envio ASC';
    const [rows] = await conn.execute(query, params);
    await conn.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  await inicializarBanco();
});