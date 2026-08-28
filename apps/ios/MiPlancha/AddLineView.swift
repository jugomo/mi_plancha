//
//  AddLineView.swift
//  MiPlancha
//
//  Created by julio on 28/08/2026.
//
import SwiftUI

struct AddLineView: View {
    let service : LinesService
    @State private var selectedProductId = ""
    @State private var amount = 1
    @Environment(\.dismiss) private var  dismiss
    

    
    var body: some View {
        NavigationStack {
            Form {
                
                Picker("Producto", selection: $selectedProductId) {
                    ForEach(service.productNames.sorted(by: { $0.value < $1.value }), id: \.key) { item in
                        Text(item.value).tag(item.key)
                    }
                    
                }
                
                Stepper("Cantidad: \(amount)", value: $amount, in: 1...20)
                
                Button("Añadir" ) {
                    guard !selectedProductId.isEmpty else { return }
                    
                    Task {
                        try? await service.addLine(productId: selectedProductId, amount: amount)
                        dismiss()
                    }
                }
                
            }
            .onAppear {
                selectedProductId = service.productNames
                    .sorted(by: {$0.value < $1.value})
                    .first?.key ?? ""
            }
        }
        
    }
}

#Preview {
    Text("Mesa 1").sheet(isPresented: .constant(true)){
        AddLineView(service: LinesService())
    }
}
