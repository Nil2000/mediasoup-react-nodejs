import { useState } from "react";
import { useNavigate } from "react-router";

export default function Home() {
  const router = useNavigate();
  const [input, setInput] = useState("");

  const handleChange = (e: any) => {
    setInput(e.target.value);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter room code"
        value={input}
        onChange={handleChange}
        className="input"
      />
      <button
        onClick={() => {
          router("/room/" + input);
        }}
      >
        Join room
      </button>
    </div>
  );
}
