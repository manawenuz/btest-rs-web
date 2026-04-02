import AuthForm from "@/components/AuthForm";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#FFFFFF" }}>
            btest-rs
            <span style={{ color: "#42A5F5" }}>-web</span>
          </h1>
          <p style={{ color: "#9E9E9E" }} className="text-lg">
            Bandwidth test result dashboard
          </p>
          <p style={{ color: "#9E9E9E" }} className="text-sm mt-2">
            Receive, store, and visualize bandwidth test results from{" "}
            <span style={{ color: "#42A5F5" }}>btest-rs-android</span> or any
            compatible client.
          </p>
        </div>

        <AuthForm />

        <div
          className="mt-8 text-center text-sm"
          style={{ color: "#9E9E9E" }}
        >
          <p>Part of the btest-rs ecosystem</p>
          <div className="flex justify-center gap-4 mt-2">
            <span>btest-rs (CLI)</span>
            <span>&middot;</span>
            <span style={{ color: "#66BB6A" }}>btest-rs-android</span>
            <span>&middot;</span>
            <span style={{ color: "#42A5F5" }}>btest-rs-web</span>
          </div>
        </div>
      </div>
    </div>
  );
}
