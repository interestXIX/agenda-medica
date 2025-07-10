const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Pasta pública para o front-end

// Conexão com o banco
const db = mysql.createPool({
  host: '160.20.22.99',
  port: 3360,
  user: 'aluno35',
  password: 'MSsSak5g41M=',
  database: 'fasiclin',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Testa conexão
db.getConnection((err, connection) => {
  if (err) {
    console.error('Erro ao conectar no banco:', err);
    return;
  }
  console.log('✅ Conectado ao MySQL!');
  connection.release();
});

// ➜ GET AGENDA (Endpoint atualizado)
app.get('/api/agenda', (req, res) => {
  const sql = `
   SELECT 
      A.IDAGENDA AS id,
      PF.NOMEPESSOA AS professionalName,
      E.DESCESPEC AS specialty,
      P.DESCRPROC AS title,
      DATE_FORMAT(A.DATAABERT, '%Y-%m-%d') AS date,
      DATE_FORMAT(A.DATAABERT, '%H:%i') AS time,
      CASE 
        WHEN P.CODPROCED LIKE 'CONS%' THEN 'consulta'
        WHEN P.CODPROCED LIKE 'CIRU%' THEN 'cirurgia'
        WHEN P.DESCRPROC LIKE '%cirurg%' THEN 'cirurgia'
        ELSE 'consulta'
      END AS type,
      A.ID_PROFISSIO AS professionalId,
      A.ID_PROCED AS procedureId,
      A.DESCRCOMP AS description,
      A.SITUAGEN AS status
    FROM AGENDA A
JOIN PROFISSIONAL PR ON A.ID_PROFISSIO = PR.IDPROFISSIO
JOIN PESSOAFIS PF ON PR.ID_PESSOAFIS = PF.IDPESSOAFIS
JOIN PROCEDIMENTO P ON A.ID_PROCED = P.IDPROCED
LEFT JOIN PROFI_ESPEC PE ON PE.ID_PROFISSIO = PR.IDPROFISSIO
LEFT JOIN ESPECIALIDADE E ON PE.ID_ESPEC = E.IDESPEC
    WHERE A.SITUAGEN = '1'
    ORDER BY A.DATAABERT
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro na consulta da AGENDA:', err);
      return res.status(500).json({ error: 'Erro ao buscar agenda.' });
    }
    res.json(results);
  });
});

// ➜ POST AGENDA (Endpoint atualizado)
app.post('/api/agenda', (req, res) => {
  const { title, professionalId, procedureId, date, time, description } = req.body;

  // Validação robusta
  if (!professionalId || !procedureId || !date || !time) {
    return res.status(400).json({ error: 'Dados obrigatórios faltando' });
  }

  const sql = `
    INSERT INTO AGENDA (
      ID_PROFISSIO,
      ID_PROCED,
      DESCRCOMP,
      DATAABERT,
      SITUAGEN,
      SOLICMASTER
    ) VALUES (?, ?, ?, ?, '1', FALSE)
  `;

  const formattedDateTime = `${date} ${time}:00`;

  db.query(sql, 
    [professionalId, procedureId, description || title, formattedDateTime],
    (err, results) => {
      if (err) {
        console.error('Erro ao inserir na AGENDA:', err);
        return res.status(500).json({ 
          error: 'Erro ao criar agendamento',
          details: err.message
        });
      }
      
      // Retorna o novo agendamento criado
      const newAppointment = {
        id: results.insertId,
        professionalId,
        procedureId,
        date,
        time,
        title,
        status: '1'
      };
      
      res.status(201).json(newAppointment);
    }
  );
});

  app.put('/api/agenda/:id', (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;

  if (!id || !date || !time) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const sql = `
    UPDATE AGENDA
    SET DATAABERT = ?
    WHERE IDAGENDA = ?
  `;

  const formattedDateTime = `${date} ${time}:00`;

  db.query(sql, [formattedDateTime, id], (err, result) => {
    if (err) {
      console.error('Erro ao atualizar agendamento:', err);
      return res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
    }

    res.json({ id, date, time });
  });
});

// ➜ DELETE AGENDA
app.delete('/api/agenda/:id', (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }

  db.query('DELETE FROM AGENDA WHERE IDAGENDA = ?', [id], (err, results) => {
    if (err) {
      console.error('Erro ao deletar da AGENDA:', err);
      return res.status(500).json({ error: 'Erro ao deletar agendamento.' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    res.status(204).send();
  });
});

// ➜ GET PROFISSIONAIS
app.get('/api/profissionais', (req, res) => {
  const sql = `
    SELECT 
  PR.IDPROFISSIO AS id,
  PF.NOMEPESSOA AS nome,
  COALESCE(GROUP_CONCAT(E.DESCESPEC SEPARATOR ', '), 'Sem Especialidade') AS especialidade
FROM PROFISSIONAL PR
JOIN PESSOAFIS PF ON PR.ID_PESSOAFIS = PF.IDPESSOAFIS
LEFT JOIN PROFI_ESPEC PE ON PE.ID_PROFISSIO = PR.IDPROFISSIO
LEFT JOIN ESPECIALIDADE E ON PE.ID_ESPEC = E.IDESPEC
WHERE PR.STATUSPROFI = '1'
GROUP BY PR.IDPROFISSIO, PF.NOMEPESSOA
ORDER BY PF.NOMEPESSOA

  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao buscar profissionais:', err);
      return res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
    res.json(results);
  });
});



// ➜ GET PROCEDIMENTOS
app.get('/api/procedimentos', (req, res) => {
  const sql = `
    SELECT IDPROCED AS id, CODPROCED, DESCRPROC 
    FROM PROCEDIMENTO
    ORDER BY DESCRPROC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao buscar procedimentos:', err);
      return res.status(500).json({ error: 'Erro ao buscar procedimentos' });
    }
    res.json(results);
  });
});
// ➜ Padrão
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err.stack);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
