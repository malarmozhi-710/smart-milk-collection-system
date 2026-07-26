# 🥛 Smart Milk Collection System

> A web-based Smart Milk Collection System developed for dairy cooperative societies to digitally record milk collection, automate payment calculations, and provide transparent records for administrators and farmers.

## 📌 Problem Statement

Build a digital collection register that records every milk delivery with quantity and rate, automatically calculates the amount payable, and provides each farmer with a clear statement of milk delivered and payments received.

This system replaces manual registers with a secure, accurate, and transparent digital solution.

---

## 🌐 Live Demo

**Application:**  
[https://smart-milk-collection-system.onrender.com](https://smart-milk-collection-system.onrender.com)

**GitHub Repository:**  
YOUR_GITHUB_REPOSITORY_LINK

---

# ✨ Features

## Administrator

- Secure Login
- Dashboard with KPIs
- Register Farmers
- Edit/Delete Farmer Records
- Record Daily Milk Collection
- Automatic Rate Calculation
- Automatic Amount Calculation
- Payment Management
- Reports
- CSV Export
- Dashboard Charts
- Notifications

## Farmer

- Secure Login
- Personal Dashboard
- View Today's Collection
- Collection History
- Payment History
- Monthly Earnings Chart
- Profile Information

---

# 🛠 Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js

### Backend

- Node.js
- Express.js

### Database

- SQLite
- Better-SQLite3

### Authentication

- JWT
- bcrypt.js

---

# 🚀 How to Run the Application

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_LINK
```

### 2. Open the Project

```bash
cd smart-milk-collection-system
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

### 5. Open in Browser

```
http://localhost:3000
```

---

# 🔑 Login Credentials

## Administrator

| Username | Password |
|----------|----------|
| admin | admin123 |

---

## Farmer

| Username | Password |
|----------|----------|
| M001 | farmer123 |

---

# 📋 Input Fields

## Farmer Registration

| Field | Description |
|--------|-------------|
| Farmer ID | Unique identifier for each farmer |
| Name | Farmer's full name |
| Phone | Contact number |
| Village | Farmer's village |
| Address | Residential address |
| Bank Details | Bank account information |
| Registration Date | Date of registration |

---

## Milk Collection

| Field | Description |
|--------|-------------|
| Farmer ID | Farmer delivering milk |
| Date | Collection date |
| Session | Morning or Evening |
| Quantity | Milk quantity in liters |
| Fat Percentage | Milk fat content (%) |
| Rate | Price per liter |
| Amount | Total payable amount |

---

## Payment

| Field | Description |
|--------|-------------|
| Total Earned | Total amount generated from milk collection |
| Paid Amount | Amount already paid to farmer |
| Pending Amount | Remaining amount yet to be paid |
| Payment Date | Date of payment |
| Status | Paid / Pending / Partially Paid |

---

# 🧮 Derived Value Calculations

### Rate Calculation

```
Rate = Fat Percentage × Rate Multiplier + Base Rate
```

Default values:

```
Rate Multiplier = 8
Base Rate = 0
```

Example:

```
Fat = 4.2%

Rate = 4.2 × 8
Rate = ₹33.60 per litre
```

---

### Amount Calculation

```
Amount = Quantity × Rate
```

Example:

```
Quantity = 12 L

Rate = ₹33.60/L

Amount = 12 × 33.60

Amount = ₹403.20
```

---

### Pending Payment

```
Pending Amount = Total Earned − Paid Amount
```

Example

```
Total Earned = ₹1500

Paid = ₹1000

Pending = ₹500
```

---

# 📁 Project Structure

```
MilkCollection
│
├── database/
│
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   └── farmer.html
│
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

---

# 📸 Screenshots

## Home Page

<img width="1850" height="912" alt="image" src="https://github.com/user-attachments/assets/430faa53-9e8a-42be-80ee-b2d58a670469" />
---

## Login Page

---

## Administrator Dashboard
<img width="1848" height="912" alt="image" src="https://github.com/user-attachments/assets/7c6f13ef-10a6-423f-b3ca-566501d8cfdb" />
---

## Farmer Dashboard

<img width="1848" height="907" alt="image" src="https://github.com/user-attachments/assets/b78b218f-e7ff-4aba-ac03-0926782045f9" />

---

# 🎥 Demonstration Video

Project demonstration video:

[**YouTube / Google Drive Link**](https://drive.google.com/file/d/1q5xKthYC4YC9CA6HlBAGNBqSQk2u2Txd/view?usp=sharing)

---
# 🔮 Future Scope

- IoT-enabled milk analyzer integration
- AI-based milk quality prediction
- Real-time payment notifications
- Digital receipt generation
- Android application
- Farmer analytics dashboard

---

# 👩‍💻 Author

**Malar Mozhi M**

B.E. Computer Science and Engineering

Prince Dr. K. Vasudevan College of Engineering and Technology

---

# 📜 License

This project was developed for educational purposes as part of the Smart India Hackathon (SIH) problem statement.
