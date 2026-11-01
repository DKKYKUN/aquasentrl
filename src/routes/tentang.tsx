import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, Droplets, LineChart, ShieldAlert } from "lucide-react";
import { Card, PageHeader } from "@/components/aqua/ui";

export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: "Tentang — Aqua Sentinel" },
      { name: "description", content: "Teknologi cerdas multi-sensor untuk deteksi dini anomali kondisi air berbasis IoT." },
      { property: "og:title", content: "Tentang — Aqua Sentinel" },
      { property: "og:description", content: "Teknologi cerdas multi-sensor untuk deteksi dini anomali air." },
    ],
  }),
  component: About,
});

const POINTS = [
  { icon: Droplets, t: "Multi-sensor", d: "Sensor pH, TDS, dan DS18B20 mengukur keasaman, zat terlarut, dan suhu air secara berkala." },
  { icon: BrainCircuit, t: "AI / Machine Learning", d: "Isolation Forest (Python, scikit-learn) mempelajari pola ketiga parameter sekaligus beserta perubahannya terhadap waktu." },
  { icon: LineChart, t: "Peringatan dini", d: "Hasil dikelompokkan menjadi Normal, Waspada, dan Anomali, lengkap dengan grafik dan riwayat." },
  { icon: ShieldAlert, t: "Indikasi awal", d: "Bukan penentu kelayakan air — kontaminan seperti bakteri tetap memerlukan uji laboratorium." },
];

function About() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Tentang Aqua Sentinel" sub="Teknologi Cerdas Multi-Sensor untuk Eksplorasi Karakteristik dan Deteksi Dini Anomali Kondisi Air Secara Real-Time Berbasis IoT" />
      <Card>
        <p className="text-sm leading-relaxed text-foreground/85">
          Air digunakan setiap hari untuk minum, mandi, mencuci, hingga pertanian, sehingga kondisinya perlu dijaga. Pemantauan manual berkala berisiko melewatkan perubahan di antara dua waktu pengukuran. Aqua Sentinel adalah prototipe sistem AIoT multi-sensor untuk memantau karakteristik air serta mendeteksi pola atau anomali secara dini, guna membantu melestarikan fungsi air dan mendukung perlindungan kesehatan masyarakat — sejalan dengan SDG 6 (Air Bersih dan Sanitasi).
        </p>
      </Card>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {POINTS.map((p, i) => (
          <Card key={p.t} className="lift" delay={80 + i * 70}>
            <div className="w-fit rounded-xl bg-brand p-2.5 text-primary-foreground"><p.icon className="h-5 w-5" /></div>
            <p className="mt-3 font-display font-bold">{p.t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4" delay={400}>
        <p className="text-xs text-muted-foreground">Tim peneliti</p>
        <p className="mt-1 font-semibold">Ridho Ahmad Azhari · Muhammad Dicky Alfasi · Bintang Rizky Varel Yadi</p>
        <p className="text-sm text-muted-foreground">Universitas Bengkulu</p>
      </Card>
    </div>
  );
}
