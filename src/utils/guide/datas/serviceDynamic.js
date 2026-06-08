export const ServiceDynamicGuide = {
  tour: "service-dynamic",
  steps: [
    {
      id: "step-1",
      tour: "service-dynamic",
      icon: <>👋</>,
      title: "Газар зүйн нэрийн дэлгэрэнгүй",
      content: (
        <p>
          Энэ хуудсанд та газар зүйн нэр, байршил, төлөв болон хэмжилт,
          хандалтын хэсгийг удирдах боломжтой..
        </p>
      ),
      side: "top",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-2",
      tour: "service-dynamic",
      icon: <>📝</>,
      title: "Дэлгэрэнгүй хэсэг",
      content: <p>Газар зүйн нэрийн дэлгэрэнгүй</p>,
      selector: "#service-detail",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-2",
      tour: "service-dynamic",
      icon: <>📝</>,
      title: "Дэлгэрэнгүй хэсэг",
      content: (
        <p>Энд дарснаар газар зүйн нэрийг газрын зураг дээр харах боломжтой.</p>
      ),
      selector: "#service-map",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-2",
      tour: "service-dynamic",
      icon: <>📝</>,
      title: "Дэлгэрэнгүй хэсэг",
      content: <p>Газар зүйн нэрийн зургууд</p>,
      selector: "#service-photos",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-2",
      tour: "service-dynamic",
      icon: <>📝</>,
      title: "Хэмжилтүүд",
      content: <p>Газар зүйн нэрийн хэмжилтүүд</p>,
      selector: "#service-measure",
      side: "bottom",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-2",
      tour: "service-dynamic",
      icon: <>📝</>,
      title: "Хэмжилтүүд",
      content: <p>Газар зүйн нэрийн хэмжилт нэмэх</p>,
      selector: "#measurement-create",
      side: "left",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-5",
      tour: "service-dynamic",
      icon: <>✏️</>,
      title: "Хэмжилтүүд",
      content: (
        <p>
          Газар зүйн нэрийн хэмжилтэд хэмжилт нэмэх, засах, хуулах мөн сагслах
          боломжтой.
        </p>
      ),
      selector: "#measurement-edit-0",
      side: "left",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: "step-5",
      tour: "service-dynamic",
      icon: <>✏️</>,
      title: "Хандалт",
      content: (
        <p>
          Тухайн газар зүйн нэр нийт хэд борлуулагдсан мэдээлэл болон актын
          жагсаалтыг эндээс үзэх боломжтой.
        </p>
      ),
      selector: "#service-access",
      side: "top",
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
};
