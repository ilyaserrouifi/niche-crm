-- ============================================================
-- NICHE CRM - DONNÉES DE TEST (SEED)
-- ============================================================

-- Supprimer les données existantes (optionnel)
TRUNCATE TABLE calls, outreach_messages, tasks, leads, users, invoices, expenses RESTART IDENTITY CASCADE;

-- ============================================================
-- 1. UTILISATEURS (admins, callers, outreachers, freelancers, clients)
-- ============================================================

-- Admin
INSERT INTO users (email, password_hash, full_name, username, phone, role, status, salary, created_at) VALUES
('admin@niche-crm.com', 'admin123', 'Admin Niche', 'admin', '+212600000001', 'admin', 'active', 5000, NOW());

-- Cold Callers
INSERT INTO users (email, password_hash, full_name, username, phone, role, status, salary, niche, created_at) VALUES
('sophia@niche-crm.com', 'caller123', 'Sophia Mansouri', 'sophia_caller', '+212600000002', 'caller', 'active', 1800, 'SaaS', NOW()),
('karim@niche-crm.com', 'caller123', 'Karim Benali', 'karim_caller', '+212600000003', 'caller', 'active', 2000, 'E-commerce', NOW()),
('leila@niche-crm.com', 'caller123', 'Leila Othmani', 'leila_caller', '+212600000004', 'caller', 'active', 1700, 'HealthTech', NOW());

-- Outreachers
INSERT INTO users (email, password_hash, full_name, username, phone, role, status, salary, created_at) VALUES
('yassin@niche-crm.com', 'out123', 'Yassin Tazi', 'yassin_out', '+212600000005', 'outreacher', 'active', 1900, NOW()),
('nadia@niche-crm.com', 'out123', 'Nadia Saidi', 'nadia_out', '+212600000006', 'outreacher', 'active', 1850, NOW());

-- Freelancers
INSERT INTO users (email, password_hash, full_name, username, phone, role, status, salary, skills, rating, created_at) VALUES
('omar@niche-crm.com', 'free123', 'Omar Dev', 'omar_dev', '+212600000007', 'freelancer', 'active', 45, ARRAY['React', 'Node.js', 'TypeScript'], 4.8, NOW()),
('sarah@niche-crm.com', 'free123', 'Sarah Designer', 'sarah_design', '+212600000008', 'freelancer', 'active', 50, ARRAY['UI/UX', 'Figma', 'Adobe XD'], 4.9, NOW()),
('mehdi@niche-crm.com', 'free123', 'Mehdi SEO', 'mehdi_seo', '+212600000009', 'freelancer', 'active', 40, ARRAY['SEO', 'Content', 'Analytics'], 4.7, NOW());

-- Clients
INSERT INTO users (email, password_hash, full_name, username, phone, role, status, created_at) VALUES
('client1@techcorp.com', 'client123', 'TechCorp Solutions', 'techcorp', '+212600000010', 'client', 'active', NOW()),
('client2@greenwave.com', 'client123', 'GreenWave Energy', 'greenwave', '+212600000011', 'client', 'active', NOW()),
('client3@medicare.com', 'client123', 'MediCare Plus', 'medicare', '+212600000012', 'client', 'active', NOW());

-- ============================================================
-- 2. LEADS (Pipeline)
-- ============================================================

INSERT INTO leads (company_name, contact_name, contact_email, source, niche, estimated_value, stage, assigned_to, created_at, updated_at) VALUES
('TechCorp Solutions', 'Ahmed Berrada', 'ahmed@techcorp.com', 'Cold Call', 'SaaS', 25000, 'LEAD', 2, NOW(), NOW()),
('GreenWave Energy', 'Fatima Zahra', 'fatima@greenwave.ma', 'Email', 'Energy', 35000, 'CONTACTED', 3, NOW(), NOW()),
('MediCare Plus', 'Dr. Youssef', 'youssef@medicare.com', 'Referral', 'HealthTech', 42000, 'MEETING_BOOKED', 2, NOW(), NOW()),
('DigitalBoost Agency', 'Nadia Saidi', 'nadia@digitalboost.com', 'LinkedIn', 'Marketing', 18000, 'QUALIFIED', 4, NOW(), NOW()),
('Swift Logistics', 'Hamid Alami', 'hamid@swiftlogistics.ma', 'Cold Call', 'Logistics', 28000, 'PROPOSAL_SENT', 3, NOW(), NOW()),
('EduTech Maroc', 'Sanaa Benali', 'sanaa@edutech.ma', 'Email', 'Education', 15000, 'NEGOTIATING', 2, NOW(), NOW()),
('FinTech Solutions', 'Omar Fassi', 'omar@fintech.ma', 'Referral', 'FinTech', 55000, 'CLOSED_WON', 4, NOW(), NOW()),
('Retail Store', 'Imane Bouazza', 'imane@retailstore.ma', 'Cold Call', 'Retail', 12000, 'CLOSED_LOST', 3, NOW(), NOW());

-- ============================================================
-- 3. APPELS (Calls)
-- ============================================================

INSERT INTO calls (lead_id, caller_id, company_called, call_time, duration, outcome, pain_noted, next_action) VALUES
(1, 2, 'TechCorp Solutions', NOW() - INTERVAL '2 days', 480, 'Meeting Booked', 'Need faster deployment', 'Send proposal'),
(2, 3, 'GreenWave Energy', NOW() - INTERVAL '1 day', 320, 'Pickup', 'Budget concerns', 'Follow-up next week'),
(3, 2, 'MediCare Plus', NOW() - INTERVAL '3 days', 600, 'Meeting Booked', 'Compliance issues', 'Schedule demo'),
(4, 4, 'DigitalBoost Agency', NOW() - INTERVAL '1 day', 240, 'Pickup', 'Interested in SEO', 'Send case studies');

-- ============================================================
-- 4. PROJETS
-- ============================================================

INSERT INTO projects (client_id, project_name, description, start_date, end_date, budget, status, progress) VALUES
(8, 'Site Web TechCorp', 'Refonte complète du site corporate', '2026-01-01', '2026-06-30', 25000, 'active', 75),
(8, 'Campagne SEA', 'Google Ads pour TechCorp', '2026-02-01', '2026-07-31', 12000, 'active', 50),
(9, 'Application Mobile', 'App mobile pour GreenWave', '2026-03-01', '2026-09-30', 35000, 'active', 30),
(10, 'Dashboard Santé', 'Dashboard patient pour MediCare', '2026-01-15', '2026-05-15', 22000, 'completed', 100);

-- ============================================================
-- 5. TÂCHES
-- ============================================================

INSERT INTO tasks (project_id, assigned_to, task_name, description, priority, status, due_date, visible_to_client) VALUES
(1, 7, 'Design UI/UX', 'Créer les maquettes du site', 'high', 'done', '2026-02-15', true),
(1, 8, 'Développement Frontend', 'Intégration React', 'high', 'in_progress', '2026-04-30', true),
(1, 7, 'SEO Optimisation', 'Optimiser le référencement', 'medium', 'todo', '2026-05-30', false),
(2, 9, 'Campagne Ads', 'Configuration Google Ads', 'high', 'in_progress', '2026-04-15', true),
(3, 7, 'App Design', 'Design de l''application mobile', 'high', 'todo', '2026-05-20', true);

-- ============================================================
-- 6. FACTURES (Invoices)
-- ============================================================

INSERT INTO invoices (client_id, invoice_number, amount, status, due_date, paid_at, created_at) VALUES
(8, 'INV-2026-001', 12500, 'paid', '2026-02-15', '2026-02-10', NOW()),
(8, 'INV-2026-002', 12500, 'pending', '2026-03-15', NULL, NOW()),
(9, 'INV-2026-003', 17500, 'paid', '2026-02-28', '2026-02-25', NOW()),
(10, 'INV-2026-004', 22000, 'paid', '2026-03-10', '2026-03-05', NOW());

-- ============================================================
-- 7. DÉPENSES (Expenses)
-- ============================================================

INSERT INTO expenses (category, amount, vendor, expense_date, recurring) VALUES
('Tools', 99, 'Apollo.io', '2026-05-01', true),
('Tools', 97, 'Instantly', '2026-05-01', true),
('Tools', 99, 'Expandi', '2026-05-01', true),
('Marketing', 500, 'Google Ads', '2026-05-10', false),
('Office', 200, 'Bureau Vallée', '2026-05-05', false);

-- ============================================================
-- 8. AFFICHER RÉCAPITULATIF
-- ============================================================

SELECT '=== DONNÉES INSÉRÉES AVEC SUCCÈS ===' as message;
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Leads', COUNT(*) FROM leads
UNION ALL
SELECT 'Calls', COUNT(*) FROM calls
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses;
-- ============================================================
-- 9. CLIENTS TABLE + STAFFING DEMO DATA
-- ============================================================
INSERT INTO clients (company, contact, email, phone, niche, budget, status) VALUES
('Atlas Growth Studio', 'Sara Bennani', 'sara@atlasgrowth.test', '+212600000001', 'Marketing', 12000, 'active'),
('Northwind Dental', 'Adam Clark', 'adam@northwind.test', '+15550000002', 'Healthcare', 8500, 'active'),
('SaaS Pilot', 'Maya Stone', 'maya@saaspilot.test', '+15550000003', 'SaaS', 16000, 'pending')
ON CONFLICT DO NOTHING;

INSERT INTO staffing_requests (company_name, skill, description, budget, timeline, status) VALUES
('Atlas Growth Studio', 'Design', 'Landing page redesign and brand assets', 3000, '2 weeks', 'Open'),
('Northwind Dental', 'SEO', 'Local SEO campaign and monthly reporting', 1800, '1 month', 'Open')
ON CONFLICT DO NOTHING;
