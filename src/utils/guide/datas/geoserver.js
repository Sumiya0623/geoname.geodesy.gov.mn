
export const GeoserverGuide = {
  tour: 'geoserver',
  steps: [
    {
      id: 'step-1',
      tour: 'geoserver',
      icon: <>👋</>,
      title: 'Geoserver тохиргоо',
      content: (
        <p>
          Geoserver-ийн тохиргооны хуудас.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'geoserver',
      icon: <>📝</>,
      title: 'Workspace',
      content: (
        <p>
          Workspace-ийн жагсаалт болон түүнд хамаарах Service энд харагдана.
        </p>
      ),
      selector: '#geoserver-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'geoserver',
      icon: <>✏️</>,
      title: 'Дэлгэрэнгүй',
      content: (
        <p>
          Энд дарж дэлгэрэнгүй мэдээлэл болон бусад удирдлагын хэсэгрүү нэвтрэх болно.
        </p>
      ),
      selector: '#geoserver-rate-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'geoserver',
      icon: <>✏️</>,
      title: 'LayerGroup тохиргоо',
      content: (
        <p>
          {/* Workspace-ийн жагсаалт болон түүнд хамаарах Service энд харагдана. */}
          Энд давхаргуудын жагсаалт харагдана.
        </p>
      ),
      selector: '#group-table',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'geoserver',
      icon: <>✏️</>,
      title: 'LayerGroup тохиргоо',
      content: (
        <p>
          Энд дарж шинээр нэмэх боломжтой.
        </p>
      ),
      selector: '#group-add',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'geoserver',
      icon: <>✏️</>,
      title: 'LayerGroup тохиргоо',
      content: (
        <p>
          Энд дарж засах боломжтой.
        </p>
      ),
      selector: '#group-update-0',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
}
