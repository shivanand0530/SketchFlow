// import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle, Square, Dot, Pentagon, Minus, StickyNote, Palette, ZoomIn, Save } from "lucide-react";
import { useNavigate } from "react-router";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: Circle, title: "Basic Shapes", description: "Draw circles, rectangles, and points" },
    { icon: Pentagon, title: "Complex Shapes", description: "Create polygons and polylines" },
    { icon: StickyNote, title: "Notes", description: "Add text annotations anywhere" },
    { icon: Palette, title: "Customization", description: "Choose colors for your elements" },
    { icon: ZoomIn, title: "Pan & Zoom", description: "Navigate your canvas freely" },
    { icon: Save, title: "Auto-Save", description: "Your work is saved automatically" },
  ];

  return (
    <div className="min-h-screen flex flex-col"
    >
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div>
            <img
              src="./logo.svg"
              alt="SketchFlow"
              width={80}
              height={80}
              className="mx-auto mb-6"
            />
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
              SketchFlow
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              A powerful, intuitive drawing application for creating shapes, diagrams, and notes.
              Everything you draw flows seamlessly and is automatically saved.
            </p>
            <Button size="lg" onClick={() => navigate("/canvas")} className="text-lg px-8 py-6">
              Start Drawing
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title}>
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <Icon className="h-10 w-10 mb-2 text-primary justify-center" />
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="mt-16 text-left max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Quick Start Guide</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Select a tool from the toolbar to start drawing</li>
              <li>• Use the color picker to customize your shapes</li>
              <li>• Pan with Ctrl + Drag or Middle Mouse Button</li>
              <li>• Zoom with Mouse Wheel</li>
              <li>• Press Enter to complete polygons/polylines</li>
              <li>• Press Delete to remove selected shapes</li>
              <li>• Your canvas is automatically saved to your browser</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}