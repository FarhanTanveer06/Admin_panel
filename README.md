# Admin Panel — Backend Developer Intern Assignment (Trends Bird Limited)

This is my submission for the Backend Developer Intern assignment. It's an e-commerce admin dashboard — a REST API (Node/Express/PostgreSQL) plus a React frontend that exercises it.

I built this using Node.js, Express, PostgreSQL and Sequelize on the backend, and React + Vite on the frontend, with help from AI coding assistants along the way. I've gone through everything myself to make sure I understand how it works, not just that it runs.

## What's actually working

Out of the 9 modules in the spec, I completed 6:

- Authentication
- Permission
- Role
- User
- Media
- Category

Brand, Attribute and Product are not built yet. I followed the build order in the assignment on purpose, and prioritized getting access control (guards, 401/403 handling) solid across every module I did build, rather than rushing through all 9 with weaker enforcement. I'd rather submit 6 modules that are actually locked down properly than 9 that aren't.

## Getting it running

You'll need Node.js and PostgreSQL installed and running locally.

**1. Install dependencies**

```bash
cd backend
npm install

cd ../frontend
npm install
```

**2. Set up your `.env` files**

There are two separate `.env` files — one for the backend, one for the frontend. I've included `.env.example` in both folders showing what's needed.

`backend/.env`: