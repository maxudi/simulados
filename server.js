const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão interna direta com o serviço MariaDB do EasyPanel
const dbConfig = {
  host: process.env.DB_HOST || 'geral_mariadb',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'max',
  password: process.env.DB_PASSWORD || '148ciapm',
  database: process.env.DB_NAME || 'geral'
};

// Cria a tabela automaticamente se ainda não existir
async function inicializarBanco() {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS resultados_simulado (
        id INT AUTO_INCREMENT PRIMARY KEY,
        aluno VARCHAR(150) NOT NULL,
        acertos INT NOT NULL,
        total_questoes INT NOT NULL DEFAULT 40,
        nota DECIMAL(4,2) NOT NULL,
        respostas_json JSON NOT NULL,
        data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await conn.end();
    console.log('Tabela resultados_simulado verificada/criada com sucesso!');
  } catch (err) {
    console.error('Erro ao conectar/criar tabela no MariaDB:', err.message);
  }
}

const gabarito = {
  q1: 'b', q2: 'c', q3: 'b', q4: 'a', q5: 'c',
  q6: 'b', q7: 'a', q8: 'c', q9: 'b', q10: 'c',
  q11: 'b', q12: 'b', q13: 'b', q14: 'b', q15: 'a',
  q16: 'b', q17: 'a', q18: 'b', q19: 'b', q20: 'b',
  q21: 'b', q22: 'c', q23: 'b', q24: 'c', q25: 'b',
  q26: 'a', q27: 'b', q28: 'a', q29: 'b', q30: 'b',
  q31: 'b', q32: 'a', q33: 'b', q34: 'b', q35: 'b',
  q36: 'b', q37: 'b', q38: 'b', q39: 'c', q40: 'b'
};

// Rota que recebe o envio do formulário HTML
app.post('/avaliar', async (req, res) => {
  const { aluno, respostas } = req.body;

  if (!aluno || !respostas) {
    return res.status(400).json({ status: 'erro', mensagem: 'Dados incompletos.' });
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
      'INSERT INTO resultados_simulado (aluno, acertos, total_questoes, nota, respostas_json) VALUES (?, ?, ?, ?, ?)',
      [aluno.trim(), acertos, total, nota, JSON.stringify(respostas)]
    );
    await conn.end();

    res.json({ status: 'ok', aluno: aluno.trim(), acertos, total, nota });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro ao salvar no banco de dados.' });
  }
});

// Rota simples para você consultar as notas pelo navegador (/notas)
app.get('/notas', async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT id, aluno, acertos, total_questoes, nota, data_envio FROM resultados_simulado ORDER BY nota DESC, data_envio ASC'
    );
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