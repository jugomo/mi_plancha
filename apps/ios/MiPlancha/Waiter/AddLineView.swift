//
//  AddLineView.swift
//  MiPlancha
//
//  Created by julio on 28/08/2026.
//
import SwiftUI

struct AddLineView: View {
    let service : LinesService
    @State private var amount = 1
    @Environment(\.dismiss) private var  dismiss
    @State private var quantities: [String : Int] = [:]
    @State private var errorMessage: String?

    private var available: [(key: String, value: ProductInfo)] {
        service.products
            .filter { $0.value.stock > 0 }
            .sorted { $0.value.name < $1.value.name }
    }
    
    private var overCapacityProduct: String? {
        guard let capacity = service.grillCapacity else { return nil}
        return quantities.first { entry in
            let needed = (service.products[entry.key]?.capacidadUnidad ?? 0 ) * entry.value
            return needed > capacity
        }.flatMap  { service.products[$0.key]?.name }
    }
    
    var body: some View {
        NavigationStack {
            List(available, id: \.key) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.value.name)
                        Text("Disponible \(item.value.stock)")
                            .font (.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Stepper(
                        "\(quantities[item.key, default: 0])",
                        value:Binding(
                            get: {quantities[item.key, default: 0]},
                            set: {quantities[item.key] = $0}
                        ),
                        in: 0...item.value.stock
                    )
                    if overCapacityProduct == item.value.name {
                        Text("Supera la capacidad de la parrilla")
                            .font(.caption).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Nuevo pedido")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enviar") {
                        let lines = quantities
                            .filter { $0.value > 0 }
                            .map {(productId: $0.key, amount: $0.value)}
                        Task{
                            do {
                                try await service.addOrder(lines: lines)
                                dismiss()
                            } catch LinesError.lineExceeedsGrillCapacity(let name) {
                                errorMessage = "\(name) no cabe en la plancha"
                            } catch {
                                errorMessage = "Error al crear el pedido"
                            }
                        }
                    }
                    .disabled(!quantities.values.contains { $0 > 0} || overCapacityProduct != nil)
                }
                
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                
            }
            .alert(errorMessage ?? "", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
                )) {
                    Button("OK") { errorMessage = nil }
            }
        }
    }
        
}

#Preview {
    Text("Mesa 1").sheet(isPresented: .constant(true)){
        AddLineView(service: LinesService())
    }
}
