export default function Shell({ name, tag, description, repo, children }) {
  return (
    <main className="page">
      <header className="hero">
        {tag ? <span className="chip">{tag}</span> : null}
        <h1>{name}</h1>
        <p className="lede">{description}</p>
      </header>
      {children}
      <footer className="footer">
        built by{" "}
        <a href="https://www.rishabhsingh.tech" target="_blank" rel="noreferrer">
          rishabh singh
        </a>
        {" · "}
        <a href={`https://github.com/singhrishabh93/${repo}`} target="_blank" rel="noreferrer">
          source
        </a>
        {" · "}
        <a href="https://www.rishabhsingh.tech/mini-apps" target="_blank" rel="noreferrer">
          more mini apps
        </a>
      </footer>
    </main>
  );
}
