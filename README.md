# E-Commerce Store (Express.js + HTML)

This is a simple and functional **E-commerce Store** built using **Express.js (Node.js backend)** and a **static HTML frontend**.  
It includes product listing, product details page, and a basic backend API for serving product data.

---

## 🚀 Project Overview

- A minimal but complete **Express.js backend**
- Static **HTML/CSS/JS** based user interface
- Displays product cards
- Individual product detail page
- Clean folder structure like real-world Express projects
- Focus on learning Express routing, middleware, static files, and templating (if added)

---

## 📂 Folder Structure

```
ecommerce-store/
│
├── server.js                 # Express.js backend server
├── /public
│     ├── index.html          # Homepage with products
│     ├── product.html        # Product details page
│     ├── /css                # Styling files
│     ├── /js                 # Client-side scripts
│     └── /images             # Product images
│
└── /data
      └── products.json       # Product database (sample)
```

---

## 🎯 Features

- ✔ Express.js backend  
- ✔ REST API endpoint for product data  
- ✔ Homepage with multiple product cards  
- ✔ Product details shown dynamically  
- ✔ Static assets served using Express  
- ✔ Ready for expansion into full-stack store  

---

## 🛠️ Technologies Used

- **Node.js**
- **Express.js**
- **HTML5**
- **CSS3**
- **JavaScript**
- **JSON-based Data Storage**

---

## 📌 How It Works

1. User opens `index.html`  
2. All products are fetched from Express backend API  
3. Clicking a product → redirects to product details page  
4. Product page displays full information  

Backend Routes Example:

```
GET /api/products         → returns all products
GET /api/products/:id     → returns single product
```

---

## 🚀 How to Run Locally

1. Install dependencies  
   ```
   npm install
   ```

2. Start the server  
   ```
   node server.js
   ```
   Server runs at:
   ```
   http://localhost:3000
   ```

3. Open your browser and visit the homepage.

---

## 🌟 Future Enhancements

- Add database (MongoDB / MySQL / Firebase)
- Add user login/signup
- Add shopping cart system
- Add payment integration
- Add admin dashboard to add/remove products
- Convert HTML pages to EJS for dynamic templates

---

## 📸 Screenshots (Add later)

- Homepage  
- Product details  
- API response demo  
- Terminal server logs  

---

## 📚 Learning Outcomes

This project helped me understand:

- Express.js routing  
- Serving static files  
- JSON APIs  
- Frontend + backend folder structure  
- Fetching API data in browser  

---

## ⭐ Contribution

Feel free to fork or contribute improvements!

---

If you find this project useful, consider giving the repository a ⭐.
