import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router";
import Home from "./components/Home";
import Room from "./components/Room";
function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
